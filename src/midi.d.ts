import { DecodeStream } from '@lachenmayer/midi-messages'

type MidiMessage = Parameters<typeof DecodeStream.prototype._onmessage>[0]

export default MidiMessage
