import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Placeholder from './pages/Placeholder.jsx'
import { NAV } from './nav.js'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {NAV.filter((n) => n.to !== '/').map((n) => (
          <Route key={n.to} path={n.to} element={<Placeholder item={n} />} />
        ))}
      </Route>
    </Routes>
  )
}