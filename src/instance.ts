import {
	createModuleLogger,
	type CardGenerator,
	type ModuleLogger,
	type SurfaceContext,
	type SurfaceDrawProps,
	type SurfaceFirmwareUpdateInfo,
	type SurfaceInstance,
} from '@companion-surface/base'
import type { MCUDeviceInfo } from './main.js'
import { DecodeStream, encode } from '@lachenmayer/midi-messages'
import type { Transform } from 'node:stream'
import type MidiMessage from './midi.d.ts'
import type { Layout } from './layouts/base.js'
import { ContextEventMap, ControlBase, type ControlMessenger, type MidiTrigger } from './controls/base.js'
import type { ControlMessage } from 'rtpmidi'
import hash from 'object-hash'

export class MCUInstance implements SurfaceInstance, ControlMessenger {
	private readonly logger: ModuleLogger
	private readonly context: SurfaceContext

	private readonly config: MCUDeviceInfo

	private readonly stream: any
	private readonly decode: DecodeStream = new DecodeStream()

	private readonly _layout: Layout

	private readonly midiTriggerMap: Map<string, ControlBase> = new Map<string, ControlBase>()
	private readonly variableMap: Map<string, ControlBase> = new Map<string, ControlBase>()

	private initialized: boolean = false

	private heartbeat: NodeJS.Timeout | undefined

	readonly surfaceId: string
	readonly productName: string

	constructor(surfaceId: string, config: MCUDeviceInfo, context: SurfaceContext) {
		this.logger = createModuleLogger(`Instance/${surfaceId}`)

		this.config = config
		this.stream = config.stream

		this.surfaceId = surfaceId
		this.context = context
		this.productName = this.stream.name.replaceAll(/\x00/g, '').trim()

		this._layout = new config.layout(this)

		this.stream.on('message', (deltaTime: any, message: any) => {
			this.decode.write(message)
		})

		this.stream.on('control-message', this.handleControlMessage.bind(this))

		;(this.decode as unknown as Transform).on('data', this.handleMidi.bind(this))
	}

	get layout(): Layout {
		return this._layout
	}

	async init(): Promise<void> {
		for (const control of this.layout.controls) {
			for (const midiTrigger of control.midiTriggers) {
				this.midiTriggerMap.set(midiTrigger, control)
			}

			for (const variable of control.getTransferVariables()) {
				this.variableMap.set(variable.id, control)
			}
		}

		// Must wait for the connection to be established so initial updates from Companion
		// are properly received
		await this.waitForConnection()
	}

	async close(): Promise<void> {
		this.stream.end()
	}

	async waitForConnection(): Promise<void> {
		const poll = (resolv: any) => {
			if (this.initialized) {
				resolv()
			} else {
				setTimeout((_: any) => poll(resolv), 500)
			}
		}

		return new Promise(poll)
	}

	async updateConfig(config: Record<string, any>): Promise<void> {
		console.log('updateConfig', config)
	}

	async ready(): Promise<void> {}

	async setBrightness(): Promise<void> {}

	async blank(): Promise<void> {
		console.log('blank()')
	}

	async draw(signal: AbortSignal, drawProps: SurfaceDrawProps): Promise<void> {
		if (signal.aborted) return

		const control = this.layout.getControlById(drawProps.controlId)

		if (control) {
			control.draw(drawProps)
		}
	}

	onVariableValue(name: string, value: unknown): void {
		const control = this.variableMap.get(name)

		if (control) {
			control.onVariableChange(name, value)
		}
	}

	showLockedStatus?(locked: boolean, characterCount: number): void {
		console.log('showLockedStatus', locked, characterCount)
	}

	async showStatus(signal: AbortSignal, cardGenerator: CardGenerator, statusMessage: string): Promise<void> {
		console.log('showStatus', signal, cardGenerator, statusMessage)
	}

	async checkForFirmwareUpdates?(): Promise<SurfaceFirmwareUpdateInfo | null> {
		return null
	}

	private handleMidi(message: MidiMessage) {
		this.logger.debug(`Received MIDI: ${JSON.stringify(message)}`)

		const midiTrigger: MidiTrigger = {
			type: message.type,
			channel: message.channel,
			note: message.note,
			control: message.control,
			number: message.number,
		}

		const id = hash(midiTrigger, {
			respectType: false,
			excludeKeys: function (key: string) {
				return midiTrigger[key as keyof typeof midiTrigger] === undefined
			},
		})

		const control = this.midiTriggerMap.get(id)

		if (control) {
			control.onMidiMessage(message)
		}
	}

	private handleControlMessage(message: ControlMessage) {
		if (message.command !== 'synchronization') return

		if (!this.initialized) {
			this.initialized = true
		}

		if (this.heartbeat) {
			clearTimeout(this.heartbeat)
		}

		this.heartbeat = setTimeout(this.handleDisconnect.bind(this), 10000)
	}

	private handleDisconnect() {
		this.context.disconnect(new Error('Surface failed heartbeat. Disconnecting'))
	}

	sendVariableValue(name: string, value: unknown): void {
		this.context.sendVariableValue(name, value)
	}

	sendMidi(messages: MidiMessage | MidiMessage[]): void {
		if (!Array.isArray(messages)) {
			messages = [messages]
		}

		for (const message of messages) {
			this.stream.sendMessage({
				timestamp: 0,
				commands: [
					{
						data: encode(message)[0],
					},
				],
			})
		}
	}

	sendEvent(eventType: ContextEventMap, id: string): void {
		if (this.context[eventType]) {
			this.context[eventType](id)
		}
	}
}
