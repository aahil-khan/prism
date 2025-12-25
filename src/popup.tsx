import "./style.css"

function IndexPopup() {
  return (
    <div className="w-96 h-96 p-6 bg-gradient-to-br from-red-500 to-purple-600 flex flex-col items-center justify-center rounded-lg">
      <h1 className="text-4xl font-bold text-white mb-4">Hello World</h1>
      <p className="text-lg text-blue-100 mb-6">Tailwind CSS is ready!</p>
      <button className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
        Click Me
      </button>
    </div>
  )
}

export default IndexPopup
