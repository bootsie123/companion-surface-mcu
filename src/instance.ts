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

const delay = async (ms: number) => new Promise((resolve: any) => setTimeout(() => resolve(), ms))

/**
 * Implements a Companion surface instance for an MCU-compatible device.
 */
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

	/**
	 * Creates a new MCU surface instance.
	 *
	 * @param surfaceId The surface id
	 * @param config The device config and connection details
	 * @param context The Companion surface context
	 */
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

	/**
	 * Exposes the layout instance for the surface.
	 *
	 * @returns The layout instance
	 */
	get layout(): Layout {
		return this._layout
	}

	/**
	 * Initializes control mappings and waits for the RTP MIDI connection to initialize
	 *
	 * @returns A promise that resolves when the instance is ready
	 */
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

	/**
	 * Closes the underlying RTP MIDI stream.
	 *
	 * @returns A promise that resolves when the stream has been closed
	 */
	async close(): Promise<void> {
		this.stream.end()
	}

	/**
	 * Waits until the instance has received its initial synchronization message.
	 *
	 * @returns A promise that resolves once the connection is initialized
	 */
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

	async updateConfig(_config: Record<string, any>): Promise<void> {}

	/**
	 * Marks the surface as ready.
	 *
	 * @returns A promise that resolves when readiness handling is complete.
	 */
	async ready(): Promise<void> {
		this.logger.info('Surface ready!')
	}

	async setBrightness(_percent: number): Promise<void> {}

	/**
	 * Clears the surface by blanking every control.
	 *
	 * @returns A promise that resolves when the blanking is complete.
	 */
	async blank(): Promise<void> {
		for (const control of this.layout.controls) {
			await control.blank()
			await delay(1) // Prevents overwhelming the surface with MIDI commands
		}
	}

	/**
	 * Renders a control update if the surface is available and unlocked.
	 *
	 * @param signal Abort signal used to cancel the draw operation
	 * @param drawProps The draw properties passed on to the relevant controls
	 *
	 * @returns A promise that resolves when the drawing is complete
	 */
	async draw(signal: AbortSignal, drawProps: SurfaceDrawProps): Promise<void> {
		if (signal.aborted || this.context.isLocked) return

		const control = this.layout.getControlById(drawProps.controlId)

		if (control) {
			control.draw(drawProps)
		}
	}

	/**
	 * Routes a variable update to the mapped control.
	 *
	 * @param name The variable name.
	 * @param value The new variable value.
	 */
	onVariableValue(name: string, value: unknown): void {
		const control = this.variableMap.get(name)

		if (control && !this.context.isLocked) {
			control.onVariableChange(name, value)
		}
	}

	async showStatus(_signal: AbortSignal, _cardGenerator: CardGenerator, _statusMessage: string): Promise<void> {}

	/**
	 * Reports that no firmware update mechanism is available.
	 *
	 * @returns A promise that resolves to null
	 */
	async checkForFirmwareUpdates?(): Promise<SurfaceFirmwareUpdateInfo | null> {
		return null
	}

	/**
	 * Handles decoded RTP MIDI messages and routes them to the mapped control.
	 *
	 * @param message The decoded MIDI message.
	 */
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

	/**
	 * Handles RTP MIDI control messages to track the surface heartbeat.
	 *
	 * @param message The incoming control message
	 */
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

	/**
	 * Disconnects the surface (typically after the heartbeat has timed out).
	 */
	private handleDisconnect() {
		this.context.disconnect(new Error('Surface failed heartbeat. Disconnecting'))
	}

	/**
	 * Sends a variable value back to the Companion context.
	 *
	 * @param name The variable name.
	 * @param value The variable value.
	 */
	sendVariableValue(name: string, value: unknown): void {
		this.context.sendVariableValue(name, value)
	}

	/**
	 * Sends one or more MIDI messages to the surface.
	 *
	 * @param messages A single MIDI message or a list of messages to send.
	 */
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

	/**
	 * Sends a Companion context event for the specified control.
	 *
	 * @param eventType The event type to invoke on the context
	 * @param id The control id
	 */
	sendEvent(eventType: ContextEventMap, id: string): void {
		try {
			if (this.context[eventType]) {
				this.context[eventType](id)
			}
		} catch (err) {
			if (err instanceof Error) {
				if (err.message.includes('Surface not set')) {
					return this.logger.warn(`Attempted to send event ${eventType} for control ${id} before surface was set`)
				}

				this.logger.error(`Error occurred while sending event: ${err.message}`)
			} else {
				this.logger.error(`Unknown error occurred while sending event: ${err}`)
			}
		}
	}
}
