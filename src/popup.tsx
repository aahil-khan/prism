import "./style.css"
import { Button } from "~/components/ui/button"

function IndexPopup() {
  return (
    <div className="w-96 h-96 p-6 bg-gradient-to-br from-blue-500 to-purple-600 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-white mb-4">Hello World</h1>
      <p className="text-lg text-blue-100 mb-6">shadcn/ui is ready!</p>
      <Button className="bg-white text-blue-600 hover:bg-blue-50">
        Click Me
      </Button>
    </div>
  )
}

export default IndexPopup
