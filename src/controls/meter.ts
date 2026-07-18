import type { SurfaceInputVariable, SurfaceOutputVariable } from '@companion-surface/base'
import { ControlBase, MidiTriggerType, type ControlOptions, type MidiTrigger } from './base.js'

export interface ControlMeterOptions extends ControlOptions {
	channel: number
}

export enum MeterMode {
	Percent = 'percent',
	DB = 'db',
}

export class ControlMeter extends ControlBase {
	private readonly channel: number

	constructor(options: ControlMeterOptions) {
		super(options)

		this.channel = options.channel
	}

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

	onVariableChange(name: string, value: any): void {
		if (name.includes('-in-percent')) {
			this.setMeter(value, MeterMode.Percent)
		} else if (name.includes('-in-db')) {
			this.setMeter(value, MeterMode.DB)
		}
	}

	setMeter(value: number, mode: MeterMode) {
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

		super.sendMidi({
			type: MidiTriggerType.Meter,
			channel: 1,
			pressure: val,
		})
	}
}
