import type {
	HostCapabilities,
	SomeCompanionInputField,
	SurfaceInputVariable,
	SurfaceOutputVariable,
	SurfacePincodeMap,
	SurfaceSchemaLayoutDefinition,
} from '@companion-surface/base'

export function generatePincodeMap(): SurfacePincodeMap | null {
	return null
}

export function createConfigFields(): SomeCompanionInputField[] {
	return [
		{
			id: 'layout',
			type: 'dropdown',
			label: 'Select layout',
			tooltip:
				'Choose a layout that best defines your MCU compatible surface. This will determine what input/output variables are visible',
			choices: [
				{
					id: 'generic',
					label: 'Generic',
				},
				{
					id: 'xtouch',
					label: 'X-Touch',
				},
			],
			default: 'generic',
		},
	]
}
