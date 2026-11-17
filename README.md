# Homeview

A lightweight personal dashboard designed to run on a Raspberry Pi and be viewed by devices on your home network. Homeview is a static site: plain HTML, CSS, and JavaScript, with no build step, accounts, cookies, or tracking. It stores only the selected theme in browser storage.

## Features

- Live local clock and date
- Current conditions and a three-day forecast from [Open-Meteo](https://open-meteo.com/) (no API key)
- Custom recurring holidays with countdowns
- Configurable quick links and accent color
- Light and dark themes with a saved browser preference
- A Santa Snooper banner shown only in December
- Responsive layout for desktop, tablet, and mobile
- Weather is optional; the rest of the dashboard works without it

## Raspberry Pi installation

These steps install the site with Nginx on Raspberry Pi OS. The Pi and client devices should be connected to the same local network.

1. Install Nginx:

   ```sh
   sudo apt update
   sudo apt install nginx
   ```

2. Copy the project folder onto the Pi. For example, from your computer:

   ```sh
   scp -r HomeView pi@raspberrypi.local:~/homeview
   ```

   Replace `pi` and `raspberrypi.local` with your Pi's username and hostname.

3. Configure the dashboard (see [Configuration](#configuration)), then publish the static files:

   ```sh
   sudo mkdir -p /var/www/homeview
   sudo cp ~/homeview/index.html ~/homeview/styles.css ~/homeview/app.js ~/homeview/config.js /var/www/homeview/
   sudo chown -R www-data:www-data /var/www/homeview
   ```

4. Create an Nginx site configuration:

   ```sh
   sudo tee /etc/nginx/sites-available/homeview >/dev/null <<'EOF'
   server {
       listen 80 default_server;
       listen [::]:80 default_server;
       server_name _;
       root /var/www/homeview;
       index index.html;

       location / {
           try_files $uri $uri/ =404;
       }
   }
   EOF
   ```

5. Enable the site and restart Nginx:

   ```sh
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo ln -s /etc/nginx/sites-available/homeview /etc/nginx/sites-enabled/homeview
   sudo nginx -t
   sudo systemctl enable --now nginx
   sudo systemctl reload nginx
   ```

6. Open `http://raspberrypi.local` on a device on your home network. If your network does not resolve `.local` hostnames, find the Pi's local IP with `hostname -I` on the Pi and visit `http://<pi-ip>`.

To update the site later, copy the changed files into `/var/www/homeview` and reload the page.

## Configuration

Edit `config.js` before copying files to the Pi. Changes take effect after reloading the page; no build or restart is needed.

### Weather

Set latitude and longitude for your location:

```js
weather: {
  latitude: 47.6062,
  longitude: -122.3321,
  temperatureUnit: "f"
},
```

Coordinates can be found with a map application. Use `"c"` for Celsius or `"f"` for Fahrenheit. Homeview requests current weather and a short forecast from Open-Meteo only when both coordinates are set. If the service or internet connection is unavailable, the dashboard remains usable and shows a brief status message. The Open-Meteo attribution link appears when weather data is displayed.

### Quick links

Add, remove, or edit entries in `links`:

```js
{ label: "Home Assistant", url: "http://homeassistant.local:8123", icon: "🏠", color: "#e8f5ef" }
```

Each entry has a visible label, destination URL, optional icon, and optional icon background color. Use URLs trusted on your local network.

### Holidays and accent color

Add recurring dates with a month number (1–12), day number (1–31), and optional emoji icon:

```js
{ name: "Example Day", month: 6, day: 12, icon: "🌼" }
```

The four soonest valid dates are shown. Set `accentColor` to a six-digit CSS hex color, for example `"#6478e8"`.

## Privacy and network access

Homeview does not use accounts, cookies, analytics, or tracking scripts. It stores only your light/dark theme preference in localStorage in the browser you use to view the dashboard. The static site is served by your Pi. If weather coordinates are configured, the browser requests forecast data directly from Open-Meteo; this requires internet access. Quick links open in a new tab.

The Nginx setup above listens on the local network. Do not forward its port from your router unless you deliberately want to expose Homeview beyond your home.

## License

Homeview is released under the MIT License. See [LICENSE](LICENSE).
