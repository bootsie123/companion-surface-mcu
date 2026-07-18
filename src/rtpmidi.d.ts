declare module 'rtpmidi' {
	export interface ControlMessage {
		buffer: Buffer | undefined
		start: number
		command: string
		ssrc: number
		count: number
		padding: number
		timestamp1: Buffer
		timestamp2: Buffer
		timestamp3: Buffer
	}

	export const manager: any
}
