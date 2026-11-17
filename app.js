(function () {
  "use strict";

  const config = window.HOMEVIEW_CONFIG || {};
  const weatherCopy = {
    0: ["Clear sky", "☀️"],
    1: ["Mostly clear", "🌤"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"],
    45: ["Foggy", "🌫"],
    48: ["Icy fog", "🌫"],
    51: ["Light drizzle", "🌦"],
    53: ["Drizzle", "🌦"],
    55: ["Heavy drizzle", "🌧"],
    56: ["Freezing drizzle", "🌧"],
    57: ["Freezing drizzle", "🌧"],
    61: ["Light rain", "🌦"],
    63: ["Rain", "🌧"],
    65: ["Heavy rain", "🌧"],
    66: ["Freezing rain", "🌧"],
    67: ["Freezing rain", "🌧"],
    71: ["Light snow", "🌨"],
    73: ["Snow", "🌨"],
    75: ["Heavy snow", "❄️"],
    77: ["Snow grains", "🌨"],
    80: ["Light showers", "🌦"],
    81: ["Showers", "🌧"],
    82: ["Heavy showers", "🌧"],
    85: ["Snow showers", "🌨"],
    86: ["Heavy snow showers", "❄️"],
    95: ["Thunderstorms", "⛈️"],
    96: ["Thunderstorms with hail", "⛈️"],
    99: ["Thunderstorms with hail", "⛈️"]
  };

  function getCondition(code) {
    return weatherCopy[code] || ["Conditions unavailable", "☁️"];
  }

  function updateClock() {
    const now = new Date();
    document.getElementById("clock").textContent = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit"
    }).format(now);
    document.getElementById("date").textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(now);

    const hour = now.getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("greeting").textContent = greeting + " — a little view of your day";
  }

  function renderLinks() {
    const container = document.getElementById("quick-links");
    const links = Array.isArray(config.links) ? config.links : [];

    links.forEach(function (item) {
      if (!item || typeof item.label !== "string" || typeof item.url !== "string") {
        return;
      }

      const link = document.createElement("a");
      link.className = "quick-link";
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const icon = document.createElement("span");
      icon.className = "quick-link-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.icon || "🔗";
      if (item.color) {
        icon.style.setProperty("--link-icon-color", item.color);
      }

      const label = document.createElement("span");
      label.className = "quick-link-label";
      label.textContent = item.label;
      link.append(icon, label);
      container.appendChild(link);
    });

    if (!container.childElementCount) {
      container.innerHTML = '<p class="muted">Add your favorite places in config.js.</p>';
    }
  }

  function holidayDate(holiday, year) {
    const date = new Date(year, holiday.month - 1, holiday.day);
    if (date.getMonth() !== holiday.month - 1 || date.getDate() !== holiday.day) {
      return null;
    }
    return date;
  }

  function dayDifference(from, to) {
    const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toUtc - fromUtc) / 86400000);
  }

  function renderHolidays() {
    const list = document.getElementById("holiday-list");
    const today = new Date();
    const candidates = [];

    (Array.isArray(config.holidays) ? config.holidays : []).forEach(function (holiday) {
      if (!holiday || typeof holiday.name !== "string" ||
          !Number.isInteger(holiday.month) || !Number.isInteger(holiday.day) ||
          holiday.month < 1 || holiday.month > 12 || holiday.day < 1 || holiday.day > 31) {
        return;
      }

      let date = holidayDate(holiday, today.getFullYear());
      if (!date) {
        return;
      }
      if (dayDifference(today, date) < 0) {
        date = holidayDate(holiday, today.getFullYear() + 1);
      }
      if (date) {
        candidates.push({ holiday: holiday, date: date, days: dayDifference(today, date) });
      }
    });

    candidates.sort(function (a, b) {
      return a.days - b.days;
    });

    candidates.slice(0, 4).forEach(function (item) {
      const row = document.createElement("li");
      row.className = "holiday-item";

      const icon = document.createElement("span");
      icon.className = "holiday-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = item.holiday.icon || "✨";

      const details = document.createElement("span");
      details.className = "holiday-details";
      const name = document.createElement("span");
      name.className = "holiday-name";
      name.textContent = item.holiday.name;
      const date = document.createElement("span");
      date.className = "holiday-date";
      date.textContent = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(item.date);
      details.append(name, date);

      const countdown = document.createElement("span");
      countdown.className = "countdown";
      countdown.textContent = item.days === 0 ? "Today" : item.days === 1 ? "Tomorrow" : item.days + " days";

      row.append(icon, details, countdown);
      list.appendChild(row);
    });

    if (!list.childElementCount) {
      list.innerHTML = '<li class="muted">Add a few special dates in config.js.</li>';
    }
  }

  function renderPromo() {
    document.getElementById("holiday-promo").hidden = new Date().getMonth() !== 11;
  }

  function initializeTheme() {
    const root = document.documentElement;
    const toggle = document.getElementById("theme-toggle");
    const storageKey = "homeview-theme";
    let theme = "light";

    try {
      theme = window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
    } catch (error) {
      console.warn("Homeview could not read the saved theme preference:", error);
    }

    function applyTheme(nextTheme) {
      theme = nextTheme;
      root.dataset.theme = theme;
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
      toggle.querySelector(".theme-toggle-icon").textContent = theme === "dark" ? "☀️" : "🌙";
      toggle.querySelector(".theme-toggle-label").textContent = theme === "dark" ? "Light mode" : "Dark mode";
    }

    toggle.addEventListener("click", function () {
      applyTheme(theme === "dark" ? "light" : "dark");
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch (error) {
        console.warn("Homeview could not save the theme preference:", error);
      }
    });

    applyTheme(theme);
  }

  function showWeatherMessage(message) {
    const current = document.getElementById("weather-current");
    current.replaceChildren();
    const text = document.createElement("p");
    text.className = "muted";
    text.textContent = message;
    current.appendChild(text);
  }

  function renderWeather(data) {
    const current = data.current;
    const condition = getCondition(current.weather_code);
    const unit = config.weather.temperatureUnit === "f" ? "°F" : "°C";
    const temperature = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    const currentContainer = document.getElementById("weather-current");
    currentContainer.replaceChildren();

    const summary = document.createElement("div");
    summary.className = "current-summary";
    const temp = document.createElement("span");
    temp.className = "temperature";
    temp.textContent = temperature + unit;
    const description = document.createElement("div");
    description.className = "condition";
    const conditionName = document.createElement("strong");
    conditionName.textContent = condition[0];
    const location = document.createElement("span");
    location.textContent = "Feels like " + feelsLike + unit;
    description.append(conditionName, location);
    summary.append(temp, description);
    currentContainer.appendChild(summary);
    document.getElementById("weather-icon").textContent = condition[1];

    const forecast = document.getElementById("forecast");
    forecast.replaceChildren();
    data.daily.time.slice(1, 4).forEach(function (day, index) {
      const code = getCondition(data.daily.weather_code[index + 1]);
      const item = document.createElement("div");
      item.className = "forecast-day";
      const weekday = document.createElement("span");
      weekday.className = "forecast-weekday";
      weekday.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(day + "T12:00:00"));
      const icon = document.createElement("span");
      icon.className = "forecast-icon";
      icon.setAttribute("aria-label", code[0]);
      icon.textContent = code[1];
      const range = document.createElement("span");
      range.className = "forecast-range";
      range.textContent = Math.round(data.daily.temperature_2m_max[index + 1]) + "° / " +
        Math.round(data.daily.temperature_2m_min[index + 1]) + "°";
      item.append(weekday, icon, range);
      forecast.appendChild(item);
    });
    document.getElementById("weather-attribution").hidden = false;
  }

  async function loadWeather() {
    const weather = config.weather || {};
    const latitude = Number(weather.latitude);
    const longitude = Number(weather.longitude);
    if (weather.latitude === null && weather.longitude === null) {
      return;
    }
    if (weather.latitude === null || weather.longitude === null ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      showWeatherMessage("Check the latitude and longitude in config.js to enable weather.");
      return;
    }

    const isFahrenheit = weather.temperatureUnit === "f";
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: "temperature_2m,apparent_temperature,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      temperature_unit: isFahrenheit ? "fahrenheit" : "celsius",
      forecast_days: "4",
      timezone: "auto"
    }).toString();

    try {
      const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        throw new Error("Weather service returned " + response.status);
      }
      const data = await response.json();
      if (!data.current || !data.daily || !Array.isArray(data.daily.time) || data.daily.time.length < 4) {
        throw new Error("Weather response is incomplete");
      }
      renderWeather(data);
    } catch (error) {
      console.warn("Homeview weather could not be loaded:", error);
      showWeatherMessage("Weather is temporarily unavailable. The rest of Homeview is ready.");
    }
  }

  if (typeof config.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(config.accentColor)) {
    document.documentElement.style.setProperty("--accent", config.accentColor);
  }

  initializeTheme();
  updateClock();
  window.setInterval(updateClock, 1000);
  renderLinks();
  renderHolidays();
  renderPromo();
  loadWeather();
}());
