import { CameraView } from './components/CameraView'
import './App.css'

function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1>AI Personal Trainer</h1>
        <p>
          Real-time form coaching in your browser. Everything runs on-device —
          your webcam video never leaves this page.
        </p>
      </header>

      <CameraView />
    </main>
  )
}

export default App
