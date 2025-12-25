import { useState } from "react"
import "./style.css"
import { WelcomeModal } from "@/components/onboarding/WelcomeModal"

function IndexPopup() {
  const [open, setOpen] = useState(true)

  return (
    <div className="min-w-[400px] h-[300px] bg-white flex items-center justify-center">
      <WelcomeModal open={open} onOpenChange={setOpen} />
    </div>
  )
}

export default IndexPopup
