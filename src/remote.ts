import {
	createModuleLogger,
	type DetectionSurfaceInfo,
	type RemoteSurfaceConnectionInfo,
	type SomeCompanionInputField,
	type SurfacePluginRemote,
	type SurfacePluginRemoteEvents,
} from '@companion-surface/base'
import EventEmitter from 'node:events'
import type { MCUDeviceInfo } from './main.js'
import rtpmidi from 'rtpmidi'
import { LayoutManager } from './layouts/manager.js'

export interface MCUConnectionConfig {
	address: string
	port: number
	layout: string
}

export class MCURemoteService
	extends EventEmitter<SurfacePluginRemoteEvents<MCUDeviceInfo>>
	implements SurfacePluginRemote<MCUDeviceInfo>
{
	private readonly logger = createModuleLogger('RemoteService')

	private readonly activeConnections = new Map<string, string>()
	private readonly connectionRefCounts = new Map<string, number>()
	private readonly connectionLayouts = new Map<string, string>()

	private readonly connectionManager = rtpmidi.manager.createSession({
		localName: 'Companion',
		port: 5004,
	})

	private autoReconnect: NodeJS.Timeout | undefined

	readonly configFields: SomeCompanionInputField[] = [
		{
			id: 'address',
			type: 'textinput',
			label: 'IP Address',
			default: '',
		},
		{
			id: 'port',
			type: 'number',
			label: 'Port',
			default: 5004,
			min: 1,
			max: 65535,
		},
	]

	readonly defaultLayout: string = 'xtouch'

	readonly checkConfigMatchesExpression: string | null =
		'$(objA:address) == $(objB:address) && $(objA:port) == $(objB:port)'

	constructor() {
		super()

		this.configFields.push({
			id: 'layout',
			type: 'dropdown',
			label: 'Layout',
			tooltip:
				'Choose a layout that best defines your MCU compatible surface. This will determine how controls are mapped to the Companion grid',
			choices: LayoutManager.getLayoutSelection(),
			default: LayoutManager.defaultLayout.id,
		})

		this.connectionManager.on('ready', () => {
			this.logger.info('Session ready')
		})

		this.connectionManager.on('error', (err: any) => {
			this.logger.error(`Connection error: ${err}`)
		})

		this.connectionManager.on('streamAdded', (event: any) => {
			const stream = event.stream

			const info = this.createDeviceInfoFromStream(stream)

			this.emit('surfacesConnected', [info])
		})
	}

	async init(): Promise<void> {
		this.autoReconnect = setInterval(this.attemptAutoReconnect.bind(this), 10000)
	}

	async destroy(): Promise<void> {
		clearTimeout(this.autoReconnect)

		this.connectionManager.end()
	}

	async startConnections(connectionInfos: RemoteSurfaceConnectionInfo[]): Promise<void> {
		this.logger.info(`Starting connections: ${connectionInfos.map((c) => c.connectionId).join(', ')}`)

		for (const info of connectionInfos) {
			const config = info.config as Partial<MCUConnectionConfig>

			const newAddressKey = `${config.address}:${config.port}`

			if (!this.connectionLayouts.has(newAddressKey)) {
				this.connectionLayouts.set(newAddressKey, config.layout || LayoutManager.defaultLayout.id)
			}

			const oldAddressKey = this.activeConnections.get(info.connectionId)

			if (oldAddressKey === newAddressKey) {
				continue
			}

			if (oldAddressKey !== undefined) {
				const oldRefCount = this.connectionRefCounts.get(oldAddressKey)

				if (oldRefCount !== undefined) {
					if (oldRefCount <= 1) {
						this.connectionRefCounts.delete(oldAddressKey)

						this.removeConnection(oldAddressKey)
					} else {
						this.connectionRefCounts.set(oldAddressKey, oldRefCount - 1)
					}
				}
			}

			this.activeConnections.set(info.connectionId, newAddressKey)

			const currentRefCount = this.connectionRefCounts.get(newAddressKey) ?? 0

			this.connectionRefCounts.set(newAddressKey, currentRefCount + 1)

			if (currentRefCount === 0) {
				this.logger.info(`Connecting to ${config.address}:${config.port}`)

				this.connectionManager.connect({
					address: config.address,
					port: config.port,
				})
			}
		}
	}

	async stopConnections(connectionIds: string[]): Promise<void> {
		this.logger.info(`Stopping connections: ${connectionIds.join(', ')}`)

		for (const connectionId of connectionIds) {
			const addressKey = this.activeConnections.get(connectionId)

			if (!addressKey) continue

			this.activeConnections.delete(connectionId)

			const currentRefCount = this.connectionRefCounts.get(addressKey)

			if (currentRefCount == undefined) continue

			if (currentRefCount <= 1) {
				this.connectionRefCounts.delete(addressKey)

				this.removeConnection(addressKey)
			} else {
				this.connectionRefCounts.set(addressKey, currentRefCount - 1)
			}
		}
	}

	rejectSurface(surfaceInfo: DetectionSurfaceInfo<MCUDeviceInfo>): void {
		this.removeConnection(`${surfaceInfo.pluginInfo.ip}:${surfaceInfo.pluginInfo.port}`)
	}

	async scanForSurfaces(): Promise<DetectionSurfaceInfo<MCUDeviceInfo>[]> {
		this.logger.info('Scanning for surfaces...')

		const detected: DetectionSurfaceInfo<MCUDeviceInfo>[] = []

		let attempting = 0

		const existingStreams: any[] = this.connectionManager.getStreams()

		for (const [connectionId, addressKey] of this.activeConnections.entries()) {
			const stream = existingStreams.find((stream) => addressKey === this.getAddressKeyFromStream(stream))

			if (stream) {
				detected.push(this.createDeviceInfoFromStream(stream))
			} else {
				const [address, port] = addressKey.split(':')

				attempting++

				this.connectionManager.connect({
					address: address,
					port: port,
				})
			}
		}

		this.logger.info(`Scan found ${detected.length} already connected surfaces`)
		this.logger.info(`Scan is attempting to connect to ${attempting} surface${attempting != 1 ? 's' : ''}`)

		return detected
	}

	private attemptAutoReconnect() {
		const existingStreams: any[] = this.connectionManager.streams

		for (const addressKey of this.activeConnections.values()) {
			const stream = existingStreams.find(
				(stream) => addressKey === this.getAddressKeyFromStream(stream) || !stream.connectionInterval._destroyed,
			)

			if (!stream) {
				const [address, port] = addressKey.split(':')

				this.logger.info(`Attempting to reconnect to ${addressKey}`)

				this.connectionManager.connect({
					address: address,
					port: port,
				})
			}
		}
	}

	private removeConnection(addressKey: string): void {
		const streams = this.connectionManager.getStreams()

		for (const stream of streams) {
			if (addressKey === this.getAddressKeyFromStream(stream)) {
				this.connectionManager.removeStream(stream)
			}
		}
	}

	private getAddressKeyFromStream(stream: any) {
		return `${stream?.rinfo1?.address}:${stream?.rinfo1?.port}`
	}

	private createDeviceInfoFromStream(stream: any): DetectionSurfaceInfo<MCUDeviceInfo> {
		const name = stream.name.replaceAll(/\x00/g, '').trim()

		const address = stream.rinfo1.address
		const port = stream.rinfo1.port

		return {
			deviceHandle: stream.ssrc,
			surfaceId: `${name}:${stream.ssrc}`,
			description: `${name} at ${address}:${port}`,
			pluginInfo: {
				ip: address,
				port,
				stream,
				layout: LayoutManager.layoutIdToType(this.connectionLayouts.get(`${address}:${port}`)!),
			},
		}
	}
}
