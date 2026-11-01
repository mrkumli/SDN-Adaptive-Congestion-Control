import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Overview from './pages/Overview.jsx'
import Topology from './pages/Topology.jsx'
import Task1 from './pages/Task1.jsx'
import Task2 from './pages/Task2.jsx'
import Results from './pages/Results.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="/topology" element={<Topology />} />
        <Route path="/task1" element={<Task1 />} />
        <Route path="/task2" element={<Task2 />} />
        <Route path="/results" element={<Results />} />
      </Route>
    </Routes>
  )
}
