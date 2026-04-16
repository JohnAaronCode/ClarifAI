// Injects a floating "Analyze" button on news pages
const NEWS_DOMAINS = [
  "rappler.com","gmanetwork.com","abs-cbn.com","inquirer.net",
  "philstar.com","bbc.com","reuters.com","apnews.com","cnn.com",
  "theguardian.com","nytimes.com","manilatimes.net"
]

const isNewsSite = NEWS_DOMAINS.some(d => location.hostname.includes(d))

if (isNewsSite) {
  // Add floating analyze button
  const btn = document.createElement("div")
  btn.id = "clarifai-fab"
  btn.innerHTML = `
    <div style="
      position:fixed;bottom:24px;right:24px;z-index:99999;
      width:52px;height:52px;border-radius:50%;
      background:linear-gradient(135deg,#2563eb,#1d4ed8);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;box-shadow:0 4px 16px rgba(37,99,235,0.5);
      transition:transform 0.2s;
    " title="Analyze with ClarifAI"
    onmouseover="this.style.transform='scale(1.1)'"
    onmouseout="this.style.transform='scale(1)'"
    onclick="document.getElementById('clarifai-fab').remove();chrome.runtime.sendMessage({action:'analyze',url:location.href})">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    </div>
  `
  document.body.appendChild(btn)
}