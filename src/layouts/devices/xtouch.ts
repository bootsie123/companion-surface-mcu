import type { SurfaceSchemaLayoutDefinition } from '@companion-surface/base'
import type { ControlBase } from '../../controls/base.js'
import { ControlButton } from '../../controls/button.js'
import { ControlDisplay } from '../../controls/display.js'
import { ControlEncoder } from '../../controls/encoder.js'
import { ControlFader } from '../../controls/fader.js'
import { Layout } from '../base.js'
import { ControlMeter } from '../../controls/meter.js'
import { ControlSegmentDisplay } from '../../controls/segment-display.js'

const stylePresets: SurfaceSchemaLayoutDefinition['stylePresets'] = {
	default: {},
	button: {
		leds: {
			segments: 1,
			mode: 'simple',
		},
	},
	encoder: {
		leds: {
			segments: 11,
			mode: 'full-ring',
		},
	},
	display: {
		text: true,
		colors: 'rgb',
	},
	segmentDisplay: {
		text: true,
	},
}

export class LayoutXTouch extends Layout {
	private commonControlOptions: any = {}

	static readonly id = 'xtouch'
	static readonly label = 'X-Touch'

	getLayoutDefinition(): SurfaceSchemaLayoutDefinition {
		const surfaceLayout: SurfaceSchemaLayoutDefinition = {
			stylePresets,
			controls: this.getControlDefinitions(),
		}

		return surfaceLayout
	}

	createLayout(): ControlBase[] {
		this.commonControlOptions = {
			stylePresets,
			messenger: this.messenger,
		}

		return ([] as ControlBase[]).concat(
			this.createButtons(),
			this.createEncoders(),
			this.createFaders(),
			this.createDisplays(),
			this.createMeters(),
			this.createSegmentDisplays(),
		)
	}

	createButtons(): ControlButton[] {
		return ([] as ControlButton[]).concat(this.createChannelStripButtons(), this.createButtonRows())
	}

	createEncoders(): ControlBase[] {
		const controls: ControlEncoder[] = []

		for (let i = 0; i < 8; i++) {
			controls.push(
				new ControlEncoder({
					midiEncoderTrigger: {
						channel: 1,
						control: 16 + i,
					},
					midiButtonTrigger: {
						channel: 1,
						note: 32 + i,
					},
					definition: {
						row: 0,
						column: i,
					},
					ledControl: 48 + i,
					name: `Channel ${i + 1}`,
					...this.commonControlOptions,
				}),
			)
		}

		// Encoder Wheel
		controls.push(
			new ControlEncoder({
				midiEncoderTrigger: {
					channel: 1,
					control: 60,
				},
				definition: {
					row: 11,
					column: 12,
				},
				...this.commonControlOptions,
			}),
		)

		return controls
	}

	createFaders(): ControlBase[] {
		const controls: ControlBase[] = []

		for (let i = 0; i < 9; i++) {
			controls.push(
				new ControlFader({
					midiTriggers: {
						channel: i + 1,
					},
					...this.commonControlOptions,
				}),
				new ControlButton({
					midiTriggers: {
						channel: 1,
						note: 104 + i,
					},
					definition: {
						row: 6,
						column: i,
					},
					...this.commonControlOptions,
				}),
			)
		}

		return controls
	}

	createDisplays(): ControlDisplay[] {
		const controls: ControlDisplay[] = []

		for (let i = 0; i < 8; i++) {
			controls.push(
				new ControlDisplay({
					channel: i + 1,
					width: 7,
					supportsBackground: true,
					definition: {
						row: 1,
						column: i,
					},
					...this.commonControlOptions,
				}),
			)
		}

		return controls
	}

	createSegmentDisplays(): ControlSegmentDisplay[] {
		const controls: ControlSegmentDisplay[] = []

		for (const [i, [control, width]] of [
			[75, -2],
			[73, -3],
			[70, -2],
			[68, -2],
			[66, -3],
		].entries()) {
			controls.push(
				new ControlSegmentDisplay({
					channel: 1,
					control,
					width,
					definition: {
						row: 1,
						column: 9 + i,
					},
					...this.commonControlOptions,
				}),
			)
		}

		return controls
	}

	createMeters(): ControlMeter[] {
		const controls: ControlMeter[] = []

		for (let i = 0; i < 8; i++) {
			controls.push(
				new ControlMeter({
					channel: i + 1,
					...this.commonControlOptions,
				}),
			)
		}

		return controls
	}

	private createChannelStripButtons(): ControlButton[] {
		const controls: ControlButton[] = []

		for (let i = 0; i < 8; i++) {
			const create = (noteOffset: number, row: number) => {
				return new ControlButton({
					midiTriggers: {
						channel: 1,
						note: noteOffset + i,
					},
					definition: {
						row,
						column: i,
					},
					...this.commonControlOptions,
				})
			}

			const rec = create(0, 2)
			const solo = create(8, 3)
			const mute = create(16, 4)
			const select = create(24, 5)

			controls.push(rec, solo, mute, select)
		}

		// Global View
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 51,
				},
				definition: {
					row: 2,
					column: 8,
				},
				...this.commonControlOptions,
			}),
		)

		// Flip
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 50,
				},
				definition: {
					row: 5,
					column: 8,
				},
				...this.commonControlOptions,
			}),
		)

		return controls
	}

	private createButtonRows(): ControlButton[] {
		const controls: ControlButton[] = []

		const createRow = (number: number | number[], row: number, noteOffset?: number, columnOffset?: number) => {
			if (!Array.isArray(number)) {
				number = Array.from(Array(number).keys())
			}

			for (let i = 0; i < number.length; i++) {
				controls.push(
					new ControlButton({
						midiTriggers: {
							channel: 1,
							note: noteOffset ? noteOffset + i : number[i],
						},
						definition: {
							row,
							column: columnOffset ? columnOffset + i : 9 + i,
						},
						...this.commonControlOptions,
					}),
				)
			}
		}

		createRow([40, 42, 44, 41, 43, 45], 0, undefined, 8) // Track, Pan/Surround, Eq, ...

		createRow(8, 2, 62) // Midi Tracks, Inputs, Audio Tracks, ...
		createRow(8, 3, 54) // F1, F2, F3, ...

		createRow([70, 71, 74, 75, 76, 80, 81], 4) // Shift, Option, Read/Off, ...
		createRow([72, 73, 77, 78, 79, 82, 83], 5) // Control Alt, Touch, ...
		createRow([84, 85, 86, 87, 88, 89, 90], 6) // Marker, Nudge, Cycle, ...

		createRow(5, 7, 91) // Backwards, Forward, Stop, ...
		createRow([46, 47, 101], 8) // Fader Bank Left, Fader Bank Right, Scrub
		createRow(2, 9, 48) // Channel Left, Channel Right

		createRow([98, 100, 99], 11) // D-Pad Left, D-Pad Center, D-Pad Right

		// D-Pad Up
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 96,
				},
				definition: {
					row: 10,
					column: 10,
				},
				...this.commonControlOptions,
			}),
		)

		// D-Pad Down
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 97,
				},
				definition: {
					row: 12,
					column: 10,
				},
				...this.commonControlOptions,
			}),
		)

		// Display
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 52,
				},
				definition: {
					row: 1,
					column: 8,
				},
				...this.commonControlOptions,
			}),
		)

		// SMPTE
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 53,
				},
				definition: {
					row: 1,
					column: 14,
				},
				...this.commonControlOptions,
			}),
		)

		return controls
	}
}
