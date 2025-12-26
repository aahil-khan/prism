import "./style.css"
import { useState } from "react"
import { EmptyState } from "@/components/sidepanel/EmptyState"
import { PopulatedState } from "@/components/sidepanel/PopulatedState"

function IndexSidePanel() {
  const [showPopulated, setShowPopulated] = useState(false)

  return (
    <div className="h-screen w-full bg-white">
      {showPopulated ? (
        <PopulatedState onShowEmpty={() => setShowPopulated(false)} />
      ) : (
        <EmptyState onShowPopulated={() => setShowPopulated(true)} />
      )}
    </div>
  )
}

export default IndexSidePanel
