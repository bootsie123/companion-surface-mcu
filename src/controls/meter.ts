import type { SurfaceInputVariable, SurfaceOutputVariable } from '@companion-surface/base'
import { ControlBase, MidiTriggerType, type ControlOptions } from './base.js'
/**
 * Options required to create the meter control.
 */
export interface ControlMeterOptions extends ControlOptions {
	channel: number // The channel/channel strip number associated with the meter (indexed from 1)
}

/**
 * Modes supported when setting the meter value.
 */
export enum MeterMode {
	Percent = 'percent', // 0-100 range
	DB = 'db', // Value in decibels
}

/**
 * Control implementation for an LED-style meter.
 */
export class ControlMeter extends ControlBase {
	private readonly channel: number

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlMeterOptions) {
		super(options)

		this.channel = options.channel
	}

	/**
	 * Returns the meter's input transfer variables to be exposed in Companion.
	 *
	 * @returns The meter's transfer variables
	 */
	getTransferVariables(): (SurfaceInputVariable | SurfaceOutputVariable)[] {
		return [
			{
				id: `meter-${this.channel}-in-percent`,
				name: `Channel ${this.channel} Meter Input %`,
				description: 'Input to set the LED meter for the channel',
				type: 'output',
			},
			{
				id: `meter-${this.channel}-in-db`,
				name: `Channel ${this.channel} Meter Input dB`,
				description: 'Input to set the LED meter for the channel',
				type: 'output',
			},
		]
	}

	/**
	 * Updates the meter's LEDs from a Companion variable change.
	 *
	 * @param name The name of the variable that changed
	 * @param value The new value of the variable
	 */
	onVariableChange(name: string, value: unknown): void {
		if (typeof value !== 'number') {
			value = parseInt(value?.toString() || (value as string))
		}

		if (name.includes('-in-percent')) {
			this.setMeter(value as number, MeterMode.Percent)
		} else if (name.includes('-in-db')) {
			this.setMeter(value as number, MeterMode.DB)
		}
	}

	/**
	 * Sets the meter's value based on a given mode.Convert an input value into the device-specific meter encoding and send it.
	 *
	 * @param value The new meter value
	 * @param mode The mode to use: percent or dB
	 */
	setMeter(value: number, mode: MeterMode): void {
		let translated: number = 0

		if (mode === MeterMode.Percent) {
			if (value === 100) {
				translated = 13
			} else if (value > 100) {
				translated = 14
			} else {
				translated = Math.round((value * 12) / 100)
			}
		} else {
			value = Math.round(value)

			if (value < -60) {
				translated = 0
			} else if (value < -50) {
				translated = 1
			} else if (value < -40) {
				translated = 2
			} else if (value < -30) {
				translated = 3
			} else if (value < -20) {
				translated = 4
			} else if (value < -14) {
				translated = 5
			} else if (value < -10) {
				translated = 6
			} else if (value < -8) {
				translated = 7
			} else if (value < -6) {
				translated = 8
			} else if (value < -4) {
				translated = 9
			} else if (value < -2) {
				translated = 10
			} else if (value < 0) {
				translated = 11
			} else if (value === 0) {
				translated = 12
			} else if (value > 0) {
				translated = 14
			}
		}

		const val = parseInt(`0x${this.channel}${translated.toString(16)}`, 16)

		this.sendMidi({
			type: MidiTriggerType.Meter,
			channel: 1,
			pressure: val,
		})
	}

	/**
	 * Blanks the meter clearing any visual state.
	 */
	async blank(): Promise<void> {}
}
