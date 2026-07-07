lucide.createIcons()

// Screenshot Lightbox
const lightbox = document.getElementById("lightbox")
const lightboxImg = document.getElementById("lightbox-img")
const closeBtn = document.querySelector(".lightbox-close")

document.querySelectorAll(".screenshot-gallery img").forEach((img) => {
  img.addEventListener("click", () => {
    lightboxImg.src = img.src
    lightbox.classList.remove("hidden")
  })
})

// Close on X click
closeBtn.addEventListener("click", () => {
  lightbox.classList.add("hidden")
})

// Close on outside click
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) {
    lightbox.classList.add("hidden")
  }
})

// Close on ESC key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    lightbox.classList.add("hidden")
  }
})

// Scroll-reveal for feature/screenshot cards
const revealEls = document.querySelectorAll(".reveal")

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible")
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.15 },
  )

  revealEls.forEach((el) => revealObserver.observe(el))
} else {
  revealEls.forEach((el) => el.classList.add("is-visible"))
}
