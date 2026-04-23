"use client"

import { useEffect } from "react"

export function PerformanceMonitor() {
  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return

    // Check Web Vitals
    if ("PerformanceObserver" in window) {
      try {
        // Largest Contentful Paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          console.log("[v0] LCP:", lastEntry.renderTime || lastEntry.loadTime)
        })
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] })

        // Cumulative Layout Shift
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          let cls = 0
          entries.forEach((entry) => {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value
            }
          })
          console.log("[v0] CLS:", cls)
        })
        clsObserver.observe({ entryTypes: ["layout-shift"] })

        // First Input Delay
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            console.log("[v0] FID:", (entry as any).processingDuration)
          })
        })
        fidObserver.observe({ entryTypes: ["first-input"] })

        return () => {
          lcpObserver.disconnect()
          clsObserver.disconnect()
          fidObserver.disconnect()
        }
      } catch (e) {
        // Silently fail if performance monitoring is not available
      }
    }
  }, [])

  return null
}
