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

/**
 * Config for an RTP MIDI connection to a remote MCU-compatible surface.
 */
export interface MCUConnectionConfig {
	address: string // IP address of the remote surface
	port: number // Port number of the remote surface
	layout: string // Layout identifier for the remote surface
}

/**
 * Manages RTP MIDI connections for MCU-compatible remote surfaces.
 */
export class MCURemoteService
	extends EventEmitter<SurfacePluginRemoteEvents<MCUDeviceInfo>>
	implements SurfacePluginRemote<MCUDeviceInfo>
{
	private readonly logger = createModuleLogger('RemoteService')

	private readonly activeConnections = new Map<string, string>()
	private readonly connectionRefCounts = new Map<string, number>()
	private readonly connectionLayouts = new Map<string, string>()

	private connectionManager: any

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
	}

	/**
	 * Initializes the RTP MIDI session and starts the auto reconnect timer.
	 *
	 * @returns A promise that resolves when initialization is complete.
	 */
	async init(): Promise<void> {
		this.connectionManager = rtpmidi.manager.createSession({
			localName: 'Companion',
			port: 5004,
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

		this.autoReconnect = setInterval(this.attemptAutoReconnect.bind(this), 10000)
	}

	/**
	 * Tears down the RTP MIDI session and auto reconnect timer.
	 *
	 * @returns A promise that resolves when shutdown is complete.
	 */
	async destroy(): Promise<void> {
		clearTimeout(this.autoReconnect)

		this.connectionManager.end()
	}

	/**
	 * Starts the remote surface connections requested by Companion.
	 *
	 * @param connectionInfos Connections to establish.
	 * @returns A promise that resolves when all connection requests have been processed.
	 */
	async startConnections(connectionInfos: RemoteSurfaceConnectionInfo[]): Promise<void> {
		this.logger.info(`Starting connections: ${connectionInfos.map((c) => c.connectionId).join(', ')}`)

		for (const info of connectionInfos) {
			const config = info.config as Partial<MCUConnectionConfig>

			const newAddressKey = `${config.address}:${config.port}`

			this.connectionLayouts.set(newAddressKey, config.layout || LayoutManager.defaultLayout.id)

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

	/**
	 * Closes requested connections using their ids.
	 *
	 * @param connectionIds Connection ids to stop.
	 * @returns A promise that resolves when all disconnect requests have been processed.
	 */
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

	/**
	 * Rejects a detected surface by removing its active RTP MIDI stream.
	 *
	 * @param surfaceInfo The detected surface to reject.
	 */
	rejectSurface(surfaceInfo: DetectionSurfaceInfo<MCUDeviceInfo>): void {
		this.removeConnection(`${surfaceInfo.pluginInfo.ip}:${surfaceInfo.pluginInfo.port}`)
	}

	/**
	 * Scans for currently connected surfaces and attempts to connect to missing ones.
	 *
	 * @returns A promise that resolves to the list of detected surfaces.
	 */
	async scanForSurfaces(): Promise<DetectionSurfaceInfo<MCUDeviceInfo>[]> {
		this.logger.info('Scanning for surfaces...')

		const detected: DetectionSurfaceInfo<MCUDeviceInfo>[] = []

		let attempting = 0

		const existingStreams: any[] = this.connectionManager.getStreams()

		for (const addressKey of this.activeConnections.values()) {
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

	/**
	 * Attempts to reconnect to any active connections with missing streams.
	 */
	private attemptAutoReconnect(): void {
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

	/**
	 * Removes all streams associated with the provided address key.
	 *
	 * @param addressKey The address key in the form `host:port`
	 */
	private removeConnection(addressKey: string): void {
		const streams = this.connectionManager.getStreams()

		for (const stream of streams) {
			if (addressKey === this.getAddressKeyFromStream(stream)) {
				this.connectionManager.removeStream(stream)
			}
		}
	}

	/**
	 * Builds an address key from a RTP MIDI stream.
	 *
	 * @param stream The RTP MIDI stream
	 * @returns The stream address key in the form `host:port`
	 */
	private getAddressKeyFromStream(stream: any): string {
		return `${stream?.rinfo1?.address}:${stream?.rinfo1?.port}`
	}

	/**
	 * Creates a Companion surface detection object from a RTP MIDI stream.
	 *
	 * @param stream The RTP MIDI stream
	 * @returns The detected surface object
	 */
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
