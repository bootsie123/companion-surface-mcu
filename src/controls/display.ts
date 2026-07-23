import type { SurfaceDrawProps, SurfaceSchemaControlDefinition } from '@companion-surface/base'
import { ControlBase, MidiTriggerType, type ControlOptions } from './base.js'
import tinycolor from 'tinycolor2'
import type MidiMessage from '../midi.d.ts'

const TEXT_COMMAND = 0x12
const BACKGROUND_COMMAND = 0x72
const EMPTY = 0x10
const NUMBER_DISPLAYS = 8
const MANUFACTURER_ID = [0x00, 0x00, 0x66]

/**
 * Options required to create a display control.
 */
export interface ControlDisplayOptions extends ControlOptions {
	channel: number // The channel/channel strip number associated with the display (indexed from 1)
	width: number // The width of the display in characters
	deviceId?: number // The device ID for the display (default: 0x14)
	supportsBackground?: boolean // Whether the display supports background color changes (default: false)
	definition: SurfaceSchemaControlDefinition // The control definition for the display
}

/**
 * Defines a background color supported by the display.
 */
export interface DisplayColor {
	id: number // The ID of the color as defined by the device
	color: tinycolor.Instance // The color value as a tinycolor instance
}

// Supported background colors (X-Touch specific)
export const displayColors: DisplayColor[] = [
	{
		id: 0, // Off
		color: tinycolor({ r: 0, g: 0, b: 0, a: 0 }),
	},
	{
		id: 1, // Red
		color: tinycolor({
			r: 255,
			g: 0,
			b: 0,
		}),
	},
	{
		id: 2, // Green
		color: tinycolor({
			r: 0,
			g: 255,
			b: 0,
		}),
	},
	{
		id: 3, // Yellow
		color: tinycolor({
			r: 255,
			g: 255,
			b: 0,
		}),
	},
	{
		id: 4, // Blue
		color: tinycolor({
			r: 0,
			g: 0,
			b: 255,
		}),
	},
	{
		id: 5, // Magenta
		color: tinycolor({
			r: 255,
			g: 0,
			b: 255,
		}),
	},
	{
		id: 6, // Cyan
		color: tinycolor({
			r: 0,
			g: 255,
			b: 255,
		}),
	},
	{
		id: 7, // White
		color: tinycolor({
			r: 255,
			g: 255,
			b: 255,
		}),
	},
]

/**
 * Control implementation for a character/text display.
 */
export class ControlDisplay extends ControlBase {
	private readonly deviceId: number = 0x14
	private readonly supportsBackground: boolean = false

	private readonly channel: number
	private readonly width: number

	private backgroundColor: DisplayColor = displayColors[0]

	private static readonly displays: Map<number, ControlDisplay> = new Map<number, ControlDisplay>()

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlDisplayOptions) {
		if (!options.definition.stylePreset) {
			options.definition.stylePreset = 'display'
		}

		super(options)

		this.channel = options.channel
		this.width = options.width

		ControlDisplay.displays.set(this.channel, this)

		if (options.deviceId) {
			this.deviceId = options.deviceId
		}

		if (options.supportsBackground) {
			this.supportsBackground = options.supportsBackground
		}
	}

	/**
	 * Draws the new text or background onto the display.
	 *
	 * @params drawProps The properties from Companion used to draw the control
	 */
	draw(drawProps: SurfaceDrawProps): void {
		if (drawProps.color && this.supportsBackground) {
			this.drawBackground(drawProps.color)
		}

		if (drawProps.text || drawProps.text === '') {
			this.drawText(drawProps.text)
		}
	}

	/**
	 * Renders text across the configured display. Text is truncated to the display
	 * width and overflows to the bottom row.
	 *
	 * @param text The text to render on the display
	 */
	drawText(text: string): void {
		text = text.substring(0, this.width * 2)

		const startTop = (this.channel - 1) * this.width
		const startBottom = this.width * NUMBER_DISPLAYS + (this.channel - 1) * this.width

		const top: number[] = []
		const bottom: number[] = []

		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i)

			if (i < this.width) {
				top.push(char)
			} else {
				bottom.push(char)
			}
		}

		const fillArray = (array: number[]) => {
			for (let i = array.length; i < this.width; i++) {
				array.push(EMPTY)
			}
		}

		fillArray(top)
		fillArray(bottom)

		this.sendMidi([
			{
				type: MidiTriggerType.Display,
				data: [TEXT_COMMAND, startTop].concat(top),
			},
			{
				type: MidiTriggerType.Display,
				data: [TEXT_COMMAND, startBottom].concat(bottom),
			},
		])

		if (this.config.autoBackground) {
			const blackBackground = tinycolor.equals(this.backgroundColor.color, displayColors[0].color)

			if (text.length > 0 && blackBackground) {
				this.drawBackground('#fff')
			} else if (text.length === 0 && !blackBackground) {
				this.drawBackground('#000')
			}
		}
	}

	/**
	 * Updates the background color for the display.
	 *
	 * This causes the background of all other displays to rerender due to
	 * the MIDI command arguments requiring all displays to be updated at once.
	 *
	 * @param color The requested background color to render
	 */
	drawBackground(color: string): void {
		this.backgroundColor = this.calcBackgroundColor(tinycolor(color).toRgb())

		const backgrounds: number[] = []

		for (let i = 1; i < NUMBER_DISPLAYS + 1; i++) {
			const display = ControlDisplay.displays.get(i)

			backgrounds.push(display ? display.backgroundColor?.id || 0 : 0)
		}

		this.sendMidi({
			type: MidiTriggerType.Display,
			data: [BACKGROUND_COMMAND].concat(backgrounds),
		})
	}

	/**
	 * Forwards MIDI messages to the surface.
	 *
	 * Ensures SysEx messages are auto wrapped with the manufacturer and device IDs.
	 *
	 * @param messages The MIDI message or array of messages to send
	 */
	sendMidi(messages: MidiMessage | MidiMessage[]): void {
		if (!Array.isArray(messages)) {
			messages = [messages]
		}

		for (const message of messages) {
			if (message.type === MidiTriggerType.Display) {
				message.deviceId = MANUFACTURER_ID

				message.data.unshift(this.deviceId)
			}
		}

		super.sendMidi(messages)
	}

	/**
	 * Calculates the Euclidean color distance between two RGBA colors.
	 *
	 * @param color1 The first RGBA color to compare
	 * @param color2 The second RGBA color to compare
	 *
	 * @returns The distance between the two colors
	 */
	private calcColorDistance(color1: tinycolor.ColorFormats.RGBA, color2: tinycolor.ColorFormats.RGBA): number {
		const r = color1.r - color2.r
		const g = color1.g - color2.g
		const b = color1.b - color2.b

		return Math.sqrt(r * r + g * g + b * b)
	}

	/**
	 * Determines the closest supported display color for a requested background.
	 *
	 * @param color The requested display color
	 *
	 * @returns The closest supported display color
	 */
	private calcBackgroundColor(color: tinycolor.ColorFormats.RGBA): DisplayColor {
		if ((color.r === 0 && color.g === 0 && color.b === 0) || color.a === 0) {
			return {
				id: 0,
				color: tinycolor({ r: 0, g: 0, b: 0, a: 0 }),
			}
		}

		let closestColor: DisplayColor = displayColors[0]

		let minDistance = this.calcColorDistance(color, displayColors[0].color.toRgb())

		for (const displayColor of displayColors) {
			const distance = this.calcColorDistance(color, displayColor.color.toRgb())

			if (distance < minDistance) {
				minDistance = distance
				closestColor = displayColor
			}
		}

		return closestColor
	}

	/**
	 * Blanks the display clearing any text and setting the background to black.
	 */
	async blank(): Promise<void> {
		this.drawText('')
		this.drawBackground('#000')
	}
}
