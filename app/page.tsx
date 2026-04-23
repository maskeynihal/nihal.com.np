import Hero from "@/components/hero"
import About from "@/components/about"
import Experience from "@/components/experience"
import Projects from "@/components/projects"
import Education from "@/components/education"
import Blog from "@/components/blog"
import Contact from "@/components/contact"
import type { Metadata } from "next"
import dynamic from "next/dynamic"

export const metadata: Metadata = {
  title: "Nihal Maskey | Senior Software Engineer",
  description:
    "Portfolio of Nihal Maskey, a Senior Software Engineer specializing in JavaScript, TypeScript, React.js, Node.js, Laravel, and AWS.",
}

const DynamicBlog = dynamic(() => import("@/components/blog"), {
  loading: () => <div className="py-20" />,
})

const DynamicEducation = dynamic(() => import("@/components/education"), {
  loading: () => <div className="py-20" />,
})

export default function Home() {
  return (
    <div className="w-full">
      <Hero />
      <About />
      <Experience />
      <Projects />
      <DynamicEducation />
      <DynamicBlog />
      <Contact />
    </div>
  )
}
