import { ControlSegmentDisplay } from '../../controls/segment-display.js'
import { LayoutMCUPro } from './mcu-pro.js'

export class LayoutMCUPro2 extends LayoutMCUPro {
	static id = 'mcupro2'
	static label = 'MCU Pro (Combined Segment Displays)'

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
