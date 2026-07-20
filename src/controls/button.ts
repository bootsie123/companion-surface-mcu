import {
	colorToIntensity,
	readLedColor,
	type SurfaceDrawProps,
	type SurfaceSchemaControlDefinition,
} from '@companion-surface/base'
import { ContextEventMap, ControlBase, MidiTriggerType, type ControlOptions, type MidiTrigger } from './base.js'
import type MidiMessage from '../midi.d.ts'

/**
 * MIDI trigger settings for the button control.
 */
export interface MidiButtonTrigger extends MidiTrigger {
	channel: number // The MIDI channel number of the button (indexed from 1)
	note: number // The MIDI note number of the button
}

/**
 * Options required to create the button control.
 */
export interface ControlButtonOptions extends ControlOptions {
	midiTriggers: MidiButtonTrigger // The MIDI trigger settings for the button
	definition: SurfaceSchemaControlDefinition // The control definition for the button
}

/**
 * Control implementation for a physical button on the surface.
 */
export class ControlButton extends ControlBase {
	private readonly midiTrigger: MidiButtonTrigger

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlButtonOptions) {
		options.midiTriggers.type = MidiTriggerType.Button

		if (!options.definition.stylePreset) {
			options.definition.stylePreset = 'button'
		}

		super(options)

		this.midiTrigger = options.midiTriggers
	}

	/**
	 * Handles incoming button MIDI messages and emit the corresponding Companion events.
	 *
	 * @param message The incoming MIDI message to process
	 */
	onMidiMessage(message: MidiMessage): void {
		this.sendEvent(message.velocity > 0 ? ContextEventMap.KeyDown : ContextEventMap.KeyUp)
	}

	/**
	 * Draws the new LED state for the button.
	 *
	 * @param drawProps The properties from Companion used to draw the control
	 */
	draw(drawProps: SurfaceDrawProps): void {
		if (drawProps.leds && this.stylePreset.leds) {
			let totalIntensity = 0

			for (let i = 0; i < this.stylePreset.leds.segments; i++) {
				totalIntensity += colorToIntensity(readLedColor(drawProps.leds, i))
			}

			this.setLed(totalIntensity >= 127)
		}
	}

	/**
	 * Sets the physical button LED on or off.
	 *
	 * @param on True if the LED should be lit, false otherwise
	 */
	setLed(on: boolean): void {
		this.sendMidi({
			type: MidiTriggerType.Button,
			channel: this.midiTrigger.channel,
			note: this.midiTrigger.note,
			velocity: on ? 127 : 0,
		})
	}
}
