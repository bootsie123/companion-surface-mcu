import {
	colorToIntensity,
	readLedColor,
	type SurfaceDrawProps,
	type SurfaceSchemaControlDefinition,
} from '@companion-surface/base'
import { ContextEventMap, ControlBase, MidiTriggerType, type ControlOptions, type MidiTrigger } from './base.js'
import type MidiMessage from '../midi.js'

export interface MidiButtonTrigger extends MidiTrigger {
	channel: number
	note: number
}

export interface ControlButtonOptions extends ControlOptions {
	midiTriggers: MidiButtonTrigger
	definition: SurfaceSchemaControlDefinition
}

export class ControlButton extends ControlBase {
	private readonly midiTrigger: MidiButtonTrigger

	constructor(options: ControlButtonOptions) {
		options.midiTriggers.type = MidiTriggerType.Button

		if (!options.definition.stylePreset) {
			options.definition.stylePreset = 'button'
		}

		super(options)

		this.midiTrigger = options.midiTriggers
	}

	onMidiMessage(message: MidiMessage): void {
		super.sendEvent(message.velocity > 0 ? ContextEventMap.KeyDown : ContextEventMap.KeyUp)
	}

	draw(drawProps: SurfaceDrawProps) {
		if (drawProps.leds && this.stylePreset.leds) {
			let totalIntensity = 0

			for (let i = 0; i < this.stylePreset.leds.segments; i++) {
				totalIntensity += colorToIntensity(readLedColor(drawProps.leds, i))
			}

			this.setLed(totalIntensity >= 127)
		}
	}

	setLed(on: boolean): void {
		super.sendMidi({
			type: MidiTriggerType.Button,
			channel: this.midiTrigger.channel,
			note: this.midiTrigger.note,
			velocity: on ? 127 : 0,
		})
	}
}
