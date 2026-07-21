import { ControlSegmentDisplay } from '../../controls/segment-display.js'
import { LayoutXTouch } from './xtouch.js'

/**
 * X-Touch variant that uses combined segment displays.
 */
export class LayoutXTouch2 extends LayoutXTouch {
	static id = 'xtouch2'
	static label = 'X-Touch (Combined Segment Displays)'

	/**
	 * Creates larger combined segment displays used by this variant.
	 *
	 * @returns An array of segment display instances
	 */
	createSegmentDisplays(): ControlSegmentDisplay[] {
		const controls: ControlSegmentDisplay[] = []

		for (const [i, [control, width]] of [
			[75, -2],
			[73, -10],
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
}
