import { Stage } from './ui/Stage';
import { Countdown, Hint, LoadingTape, MannequinControls, ShutterBar, StatusChip, TopBar } from './ui/StageOverlays';
import { Panel } from './ui/Panel';
import { CaptureViewer, Onboarding, Settings, Toasts } from './ui/Dialogs';

export default function App() {
  return (
    <div className="app">
      <Stage>
        <TopBar />
        <StatusChip />
        <LoadingTape />
        <Hint />
        <MannequinControls />
        <ShutterBar />
        <Countdown />
      </Stage>
      <Panel />
      <Onboarding />
      <Settings />
      <CaptureViewer />
      <Toasts />
    </div>
  );
}
