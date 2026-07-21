import type { SurfacePincodeMap, SurfaceSchemaLayoutDefinition } from '@companion-surface/base'
import type { ControlBase } from '../../controls/base.js'
import { ControlButton } from '../../controls/button.js'
import { ControlDisplay } from '../../controls/display.js'
import { ControlEncoder } from '../../controls/encoder.js'
import { ControlFader } from '../../controls/fader.js'
import { Layout } from '../base.js'
import { ControlSegmentDisplay } from '../../controls/segment-display.js'

/**
 * Style presets used by the MCU Pro layout.
 */
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
	},
	segmentDisplay: {
		text: true,
	},
}

/**
 * Layout implementation for the Mackie MCU Pro control surface.
 */
export class LayoutMCUPro extends Layout {
	protected commonControlOptions: any = {}

	static id = 'mcupro'
	static label = 'MCU Pro'

	getLayoutDefinition(): SurfaceSchemaLayoutDefinition {
		const surfaceLayout: SurfaceSchemaLayoutDefinition = {
			stylePresets,
			controls: this.getControlDefinitions(),
		}

		return surfaceLayout
	}

	getPincodeMap(): SurfacePincodeMap | null {
		const pincodeMap: any = {
			type: 'single-page',
			pincode: null,
		}

		const gridMap: { [k: string]: any } = {
			'6/9': 0, // Global View
			'3/9': 1, // F1
			'3/10': 2, // F2
			'3/11': 3, // F3
			'3/12': 4, // F4
			'3/13': 5, // F5
			'3/14': 6, // F6
			'3/15': 7, // F7
			'3/16': 8, // F8
			'6/8': 9, // Flip
		}

		for (const control of this.layoutControls) {
			const definition = control.getControlDefinition()

			if (definition) {
				const gridPosition = `${definition.row}/${definition.column}`
				const number = gridMap[gridPosition]

				if (number) {
					pincodeMap[number] = control.id
				}
			}
		}

		return pincodeMap
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
			this.createSegmentDisplays(),
		)
	}

	/**
	 * Create button controls for the layout.
	 *
	 * @returns An array of button instances
	 */
	createButtons(): ControlButton[] {
		return ([] as ControlButton[]).concat(this.createChannelStripButtons(), this.createButtonRows())
	}

	/**
	 * Creates encoder controls for the layout.
	 *
	 * @returns An array of encoder instances
	 */
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
						row: 1,
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
					row: 10,
					column: 13,
				},
				...this.commonControlOptions,
			}),
		)

		return controls
	}

	/**
	 * Creates fader controls and their associated touch detection as buttons.
	 *
	 * @returns An array of fader and button instances
	 */
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
						row: 7,
						column: i,
					},
					...this.commonControlOptions,
				}),
			)
		}

		return controls
	}

	/**
	 * Creates the character displays used by the layout.
	 *
	 * @returns An array of display instances
	 */
	createDisplays(): ControlDisplay[] {
		const controls: ControlDisplay[] = []

		for (let i = 0; i < 8; i++) {
			controls.push(
				new ControlDisplay({
					channel: i + 1,
					width: 7,
					supportsBackground: false,
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

	/**
	 * Creates 7-segment / small numeric displays used on the layout.
	 *
	 * @returns An array of segment display instances
	 */
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
						row: 0,
						column: 8 + i,
					},
					...this.commonControlOptions,
				}),
			)
		}

		return controls
	}

	/**
	 * Creates the standard channel strip buttons (rec/solo/mute/select) and
	 * global buttons Flip and Global View.
	 *
	 * @returns An array of button instances
	 */
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
			const solo = create(8, 4)
			const mute = create(16, 5)
			const select = create(24, 6)

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
					row: 6,
					column: 9,
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
					row: 6,
					column: 8,
				},
				...this.commonControlOptions,
			}),
		)

		return controls
	}

	/**
	 * Creates auxiliary button rows used across the surface.
	 *
	 * @returns An array of button instances
	 */
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
							column: columnOffset ? columnOffset + i : 10 + i,
						},
						...this.commonControlOptions,
					}),
				)
			}
		}

		createRow([40, 41, 52, 53], 1, undefined, 8) // Track, Send, Name/Value, SMPTE/Beats
		createRow([42, 43], 2, undefined, 8) // Pan/Surround, Plugin
		createRow([44, 45], 3, undefined, 8) // Eq, Instrument
		createRow([46, 47], 4, undefined, 8) // Fader Bank Left, Fader Bank Right
		createRow(2, 5, 48, 8) // Channel Left, Channel Right

		createRow(10, 4, 62) // Midi Tracks, Inputs, Audio Tracks, ...
		createRow(10, 3, 54) // F1, F2, F3, ...

		createRow([70, 71, 74, 75, 76, 80, 81], 5) // Shift, Option, Read/Off, ...
		createRow([72, 73, 77, 78, 79, 82, 83], 6) // Control Alt, Touch, ...
		createRow([84, 85, 86, 87, 88, 89, 90], 7) // Marker, Nudge, Cycle, ...

		createRow(5, 8, 91) // Backwards, Forward, Stop, ...

		createRow([98, 100, 99], 10) // D-Pad Left, D-Pad Center, D-Pad Right

		// D-Pad Up
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 96,
				},
				definition: {
					row: 9,
					column: 11,
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
					row: 11,
					column: 11,
				},
				...this.commonControlOptions,
			}),
		)

		// Scrub
		controls.push(
			new ControlButton({
				midiTriggers: {
					channel: 1,
					note: 101,
				},
				definition: {
					row: 10,
					column: 14,
				},
				...this.commonControlOptions,
			}),
		)

		return controls
	}
}
