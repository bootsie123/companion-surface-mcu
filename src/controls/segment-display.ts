import type { SurfaceDrawProps, SurfaceSchemaControlDefinition } from '@companion-surface/base'
import { ControlBase, MidiTriggerType, type ControlOptions } from './base.js'

const EMPTY = 0x0
const DOT = 0x40

/**
 * Options required to create a segmentdisplay control.
 */
export interface ControlSegmentDisplayOptions extends ControlOptions {
	channel: number // The MIDI channel number of the segment display (indexed from 1)
	control: number // The MIDI starting control number of the segment display (calculates additional control numbers for each digit)
	width: number // The width of the display in characters (use negative values to indicate a right-aligned display)
	definition: SurfaceSchemaControlDefinition // The control definition for the display
}

/**
 * Control implementation for a character/text display.
 */
export class ControlSegmentDisplay extends ControlBase {
	private readonly channel: number
	private readonly control: number
	private readonly width: number
	private readonly growDirection: number

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlSegmentDisplayOptions) {
		if (!options.definition.stylePreset) {
			options.definition.stylePreset = 'segmentDisplay'
		}

		super(options)

		this.channel = options.channel
		this.width = Math.abs(options.width)
		this.control = options.control
		this.growDirection = options.width > 0 ? 1 : -1
	}

	/**
	 * Draws the new text onto the display.
	 *
	 * @params drawProps The properties from Companion used to draw the control
	 */
	draw(drawProps: SurfaceDrawProps): void {
		if (drawProps.text || drawProps.text === '') {
			this.drawText(drawProps.text)
		}
	}

	/**
	 * Renders text across the configured display. Text is truncated to the display width.
	 *
	 * @param text The text to render on the display
	 */
	drawText(text: string): void {
		const chars: number[] = []

		for (let i = 0; i < text.length; i++) {
			if (chars.length >= this.width) break

			const char = text.charCodeAt(i)
			const nextChar = text.substring(i + 1, i + 2)

			if (char === '.'.charCodeAt(0)) continue

			chars.push(nextChar === '.' ? DOT | char : char)
		}

		for (let i = chars.length; i < this.width; i++) {
			chars.push(EMPTY)
		}

		for (const [i, char] of chars.entries()) {
			this.sendMidi({
				type: MidiTriggerType.SegmentDisplay,
				channel: this.channel,
				control: this.control + i * this.growDirection,
				value: char,
			})
		}
	}
}
