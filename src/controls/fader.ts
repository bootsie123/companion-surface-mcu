import type { SurfaceInputVariable, SurfaceOutputVariable } from '@companion-surface/base'
import { ControlBase, MidiTriggerType, type ControlOptions, type MidiTrigger } from './base.js'
import type MidiMessage from '../midi.d.ts'

/**
 * MIDI trigger settings for the fader control.
 */
export interface MidiFaderTrigger extends MidiTrigger {
	channel: number // The MIDI channel number of the fader (indexed from 1)
}

/**
 * Options required to create the fader control.
 */
export interface ControlFaderOptions extends ControlOptions {
	midiTriggers: MidiFaderTrigger // The MIDI trigger settings for the fader

	dbMap?: {
		dbToMidi(value: number): number // Override the default dB to MIDI mapping function
		midiToDb(value: number): number // Override the default MIDI to dB mapping function
	}
}

/**
 * Fader modes for mapping values between percent and decibel ranges.
 */
export enum FaderMode {
	Percent = 'percent', // 0-100 range
	DB = 'db', // Value in decibels
}

/**
 * Control implementation for a motorized or virtual fader.
 */
export class ControlFader extends ControlBase {
	private readonly channel: number

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlFaderOptions) {
		options.midiTriggers.type = MidiTriggerType.Fader

		super(options)

		this.channel = options.midiTriggers.channel

		if (options.dbMap) {
			if (options.dbMap.dbToMidi) {
				this.dbToMidi = options.dbMap.dbToMidi.bind(this)
			}

			if (options.dbMap.midiToDb) {
				this.midiToDb = options.dbMap.midiToDb.bind(this)
			}
		}
	}

	/**
	 * Returns the fader's input/output transfer variables to be exposed in Companion.
	 *
	 * @returns The fader's transfer variables
	 */
	getTransferVariables(): (SurfaceInputVariable | SurfaceOutputVariable)[] {
		return [
			{
				id: `${this.id}-in-percent`,
				name: `Channel ${this.channel} Fader Input %`,
				description: 'Input to set the fader position for the channel',
				type: 'output',
			},
			{
				id: `${this.id}-in-db`,
				name: `Channel ${this.channel} Fader Input dB`,
				description: 'Input to set the fader position for the channel',
				type: 'output',
			},
			{
				id: `${this.id}-out-percent`,
				name: `Channel ${this.channel} Fader Output %`,
				description: 'Outputs the current fader position for the channel',
				type: 'input',
			},
			{
				id: `${this.id}-out-db`,
				name: `Channel ${this.channel} Fader Output dB`,
				description: 'Outputs the current fader position for the channel',
				type: 'input',
			},
		]
	}

	/**
	 * Updates the fader's position from a Companion variable change.
	 *
	 * @param name The name of the variable that changed
	 * @param value The new value of the variable
	 */
	onVariableChange(name: string, value: unknown): void {
		if (typeof value !== 'number') {
			value = parseInt(value?.toString() || (value as string))
		}

		if (name.includes('-in-percent')) {
			this.sendMidiMode(value as number, FaderMode.Percent)
		} else if (name.includes('-in-db')) {
			this.sendMidiMode(value as number, FaderMode.DB)
		}
	}

	/**
	 * Handles incoming fader MIDI messages and updates the corresponding output variables.
	 *
	 * @param message The incoming MIDI message to handle
	 */
	onMidiMessage(message: MidiMessage): void {
		this.sendVariableValue(`${this.id}-out-percent`, (message.value / 16383) * 100)
		this.sendVariableValue(`${this.id}-out-db`, this.midiToDb(message.value))

		this.sendMidi(message)
	}

	/**
	 * Updates the fader position using either a percent or a dB value.
	 *
	 * @param value The new fader position
	 * @param mode The mode to use: percent or dB
	 */
	sendMidiMode(value: number, mode: FaderMode): void {
		if (mode === FaderMode.Percent) {
			value = Math.round(value * 163.83)
		} else if (mode === FaderMode.DB) {
			value = Math.max(0, Math.min(Math.round(this.dbToMidi(value)), 16383))
		}

		this.sendMidi({
			type: MidiTriggerType.Fader,
			channel: this.channel,
			value,
		})
	}

	/**
	 * Converts a dB value to the native MIDI fader position.
	 */
	private dbToMidi(x: number): number {
		/*	This equation maps the X-Touch fader dB labels to the appropriate value
			When overriding this for different devices, the following resource is recommended.

			Link: https://www.standardsapplied.com/nonlinear-curve-fitting-calculator.html
		*/

		return (
			(12723.34994 + 1500.178962 * x + 124.4959956 * x * x + 1.493039163 * x * x * x) /
			(1 + 0.08838263566 * x + 0.007957967471 * x * x - 0.0001457135814 * x * x * x)
		)
	}

	/**
	 * Converts a native MIDI fader position to decibels.
	 */
	private midiToDb(x: number): number {
		/*	This equation maps the X-Touch fader dB labels to the appropriate value
			When overriding this for different devices, the following resource is recommended.
			
			Link: https://www.standardsapplied.com/nonlinear-curve-fitting-calculator.html
		*/

		return (
			(-69.91781106 + 0.008757126244 * x - 8.57e-7 * x * x + 4.77e-11 * x * x * x) /
			(1 + 6.29e-6 * x + 3.46e-8 * x * x - 1.15e-12 * x * x * x)
		)
	}
}
