import { Component, type ReactNode } from 'react';

/** Keep navigation and portable backups reachable if a lazy workspace cannot load. */
export default class WorkspaceBoundary extends Component<{ children: ReactNode; backup: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main id="main" className="studio-loading"><h1>The workspace could not be opened.</h1><p>Your stored project is preserved. Reload to try again, or keep an editable backup.</p><div><button onClick={() => window.location.reload()}>Reload workspace</button><button onClick={this.props.backup}>Back up project</button></div></main>;
  }
}
