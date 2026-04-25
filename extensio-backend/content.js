function replaceImages() {
  document.querySelectorAll("img").forEach(img => {
    if (img.dataset.replaced) return;

    const rect = img.getBoundingClientRect();

    const div = document.createElement("div");
    div.style.width = rect.width + "px";
    div.style.height = rect.height + "px";
    div.style.backgroundColor = "red";
    div.style.display = "inline-block";

    img.dataset.replaced = "true";
    img.replaceWith(div);
  });
}

// run once
replaceImages();

// run again for dynamic content
setInterval(replaceImages, 1000);