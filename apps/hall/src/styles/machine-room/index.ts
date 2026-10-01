import './fonts';
import './css/index.css';
import type { StyleModule } from '../../core/style-module';
import { previewMachineRoom, startMachineRoom } from './shell';

/** The Machine Room: the Unix machine at night, in the Phosphor, Manual Page and Sunset Lab palettes. */
const machineRoom: StyleModule = {
  id: 'machine-room',
  start: startMachineRoom,
  preview: previewMachineRoom,
};

export default machineRoom;
