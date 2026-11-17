// Personalize your dashboard here. No build step is required.
window.HOMEVIEW_CONFIG = {
  accentColor: "#6478e8",

  // Set coordinates to enable weather. Find them with any map app.
  // Open-Meteo is a free weather service and does not require an API key.
  weather: {
    latitude: 36.8529,
    longitude: -75.9780,
    temperatureUnit: "f" // "f" or "c"
  },

  links: [
    { label: "Calendar", url: "https://calendar.google.com", icon: "📅", color: "#eaf0ff" },
    { label: "Email", url: "https://mail.google.com", icon: "📧", color: "#fff0e8" },
    { label: "Music", url: "https://music.youtube.com", icon: "🎵", color: "#f8eafa" },
    { label: "Photos", url: "https://photos.google.com", icon: "🖼️", color: "#e8f5ef" }
  ],

  // Dates repeat each year. Use month numbers 1–12 and day numbers 1–31.
  holidays: [
    { name: "New Year's Day", month: 1, day: 1, icon: "🎉" },
    { name: "Valentine's Day", month: 2, day: 14, icon: "💌" },
    { name: "Halloween", month: 10, day: 31, icon: "🎃" },
    { name: "Christmas Day", month: 12, day: 25, icon: "🎄" }
  ]
};
