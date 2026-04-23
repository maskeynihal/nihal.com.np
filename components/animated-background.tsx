"use client"

import { useEffect, useState } from "react"

export default function AnimatedBackground() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Defer rendering until after initial page load for better performance
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Don't render animated background on initial load if it's js-only
  if (!isReady) {
    return null
  }

  return (
    <div className="animated-background js-only" aria-hidden="true">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>
    </div>
  )
}
