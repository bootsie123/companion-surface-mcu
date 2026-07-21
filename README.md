# Mackie Control RTP MIDI

A companion surface module for Mackie Control-compatible devices over RTP MIDI.

This module exposes any Mackie Control-compatible device as a remote surface within Companion allowing for easy mapping of any buttons, encoders, faders, LCD displays, segment displays, meters, or LEDs on the device.

See [HELP.md](./companion/HELP.md) for the in-Companion specific documentation.

## Features

- Discovers MCU-compatible surfaces over RTP MIDI
- Supports Behringer X-Touch and Mackie MCU Pro devices
- Includes combined segment-display variants for both device families
- Maps and exposes all supported device controls
- Automatically reconnects to disconnected devices

## Supported Devices

- X-Touch (Fully Tested)
- MCU Pro (Available, not tested)

## Requirements

This module requires at least **Companion version >5.1.0** (currently in beta)

## Installation

This repository is intended to be built and installed as a Companion surface module. However, the module can be manually built for development or testing purposes.

### Local Development

First, clone the repository using [git](https://git-scm.com/) and then use [yarn](https://yarnpkg.com/) to install the necessary Node modules. If [Node.js](https://nodejs.org/) is not already installed, please do so before running yarn.

```bash
# Clone the repository
git clone https://github.com/bootsie123/companion-surface-mcu.git

# Enter the directory
cd companion-surface-mcu

# Install the dependencies
yarn install

# Build the module
yarn build

# Generate a package for manual installation in Companion
yarn package
```

### Companion

Once the module has been built and packaged (see the [Local Development](#local-development) section) or downloaded from the releases section of the repository, it can be manually installed in Companion.

1. Open the admin interface of Companion and navigate to the `Modules` tab
2. Click on `Import module package` and select the `.tar` file obtained from earlier
3. Next, go to the `Surfaces` tab and under `Surface Integrations and General Settings` click on `Add Surface Integration` and select `Mackie Control RTP MIDI`
4. The module should now be fully installed!

See [HELP.md](./companion/HELP.md) for further in-Companion usage documentation.

## Usage

Once the surface is setup as a `Remote Surface` and connected, Companion will register the selected layout and expose the device controls as a Companion surface. Incoming MIDI messages are routed to the matching control, and Companion state updates are sent back to the device.

All configuration options as described in the [in-Companion help documentation](./companion/HELP.md)

## Development

The main scripts are:

- `yarn build` - Clean and compile the TypeScript sources into `dist/`
- `yarn dev` - Compile in watch mode
- `yarn lint` - Run ESLint
- `yarn format` - Format the repository with Prettier
- `yarn package` - Builds an installable package for Companion

## Contributing

Pull requests are welcome. Any changes are appreciated!

## License

This project is licensed under the [MIT License](https://choosealicense.com/licenses/mit/).
