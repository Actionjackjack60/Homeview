# Homeview

A lightweight personal dashboard designed to run on a Raspberry Pi and be viewed by devices on your home network. Homeview uses plain HTML, CSS, and JavaScript, with no build step, accounts, cookies, or tracking. It stores only the selected theme in browser storage. An optional Python server enables local-network screen casting.

## Features

- Live local clock and date
- Current conditions and a three-day forecast from [Open-Meteo](https://open-meteo.com/) (no API key)
- Custom recurring holidays with countdowns
- Configurable quick links and accent color
- Light and dark themes with a saved browser preference
- Browser-based screen casting to other devices on your local network
- Responsive layout for desktop, tablet, and mobile
- Weather is optional; the rest of the dashboard works without it

## Screen casting

Casting uses the browser's screen-sharing permission and peer-to-peer video. The Python server serves Homeview over HTTPS and relays connection setup; screen video is sent directly between devices and is not recorded. Every device that will start a cast must trust the local certificate authority; this is required by browsers for screen sharing from a LAN page.

1. Install Python 3 and [mkcert](https://github.com/FiloSottile/mkcert) on the computer running Homeview. On Windows, install mkcert with:

   ```sh
   winget install --id FiloSottile.mkcert --exact
   ```

2. In PowerShell, install mkcert's local root certificate and create a server certificate. Replace `192.168.66.21` with this computer's current LAN IPv4 address (find it with `ipconfig`):

   ```powershell
   mkcert -install
   $certDir = Join-Path $env:LOCALAPPDATA 'Homeview\certs'
   New-Item -ItemType Directory -Force $certDir
   mkcert -cert-file (Join-Path $certDir 'homeview.pem') `
     -key-file (Join-Path $certDir 'homeview-key.pem') `
     192.168.66.21 localhost 127.0.0.1
   ```

3. From the `Homeview` folder, install the server dependency and start Homeview:

   ```sh
   python -m pip install -r requirements.txt
   python server.py
   ```

4. On each other device, trust the root certificate at the path printed by `mkcert -CAROOT` (the file is `rootCA.pem`). Transfer only `rootCA.pem`; never share `rootCA-key.pem` or the server's `homeview-key.pem`. Import the certificate into that device's trusted root certificate store, then restart its browser.
5. On any device on the same network, open the HTTPS LAN address printed by the server, such as `https://192.168.66.21:8000`. Choose **Start casting** and select a screen or window in the browser prompt. Viewers open the link or enter the code shown on the casting device and choose **Watch a cast**.
6. Choose **Stop casting** when finished. The browser's screen-share control can also stop the cast.

Use a current browser with screen-sharing support; support varies in mobile browsers. On Windows, the root certificate can be imported for the current user through `certmgr.msc` under **Trusted Root Certification Authorities**. On macOS, import it into Keychain Access and trust it; on iOS, install the profile and enable full trust in Certificate Trust Settings; on Android, install it from Security settings. The steps vary by OS and browser.

The server listens on all network interfaces at port 8000 by default. Change the port with `python server.py --port 8080` if needed. If the computer's LAN IP changes, regenerate the certificate with the new IP and restart the server. `python server.py --http` explicitly disables HTTPS, but browsers will not allow screen sharing from LAN HTTP pages. The static Nginx setup below continues to work for the dashboard but does not provide casting.

## Raspberry Pi casting setup

Use the Python server on the Pi if you want devices to cast their own screens. The Nginx-only setup below serves a static dashboard and does not provide casting.

1. Give the Pi a stable LAN address (for example, make a DHCP reservation in your router), then install the required packages:

   ```sh
   sudo apt update
   sudo apt install python3 python3-venv mkcert libnss3-tools
   ```

   If your Raspberry Pi OS release does not provide `mkcert`, install it using the instructions in the [mkcert project](https://github.com/FiloSottile/mkcert).

2. Copy the `Homeview` folder to the Pi. For example:

   ```sh
   scp -r Homeview username@raspberrypi.local:~/homeview
   ```

   Replace `username` and `raspberrypi.local` with the Pi's user and hostname.

3. On the Pi, trust mkcert's local CA and create a certificate for its LAN address and `.local` hostname:

   ```sh
   mkcert -install
   ip=$(hostname -I | awk '{print $1}')
   cert_dir="$HOME/.config/Homeview/certs"
   mkdir -p "$cert_dir"
   mkcert -cert-file "$cert_dir/homeview.pem" \
     -key-file "$cert_dir/homeview-key.pem" \
     "$ip" "$(hostname).local" localhost 127.0.0.1
   ```

   If the Pi's LAN IP changes, recreate the certificate with the new address. Configure the router's DHCP reservation first so the certificate remains valid.

4. Install the Python dependency in a virtual environment and test the server:

   ```sh
   cd ~/homeview
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r requirements.txt
   python server.py
   ```

   The server prints the HTTPS address. Stop it with `Ctrl+C` after confirming the page loads.

5. To start Homeview automatically when the Pi boots, create a systemd service. This uses the current Pi user and assumes the project is in `~/homeview`:

   ```sh
   sudo tee /etc/systemd/system/homeview.service >/dev/null <<EOF
   [Unit]
   Description=Homeview dashboard and casting server
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   User=$USER
   WorkingDirectory=$HOME/homeview
   ExecStart=$HOME/homeview/.venv/bin/python $HOME/homeview/server.py
   Restart=on-failure

   [Install]
   WantedBy=multi-user.target
   EOF
   sudo systemctl daemon-reload
   sudo systemctl enable --now homeview
   sudo systemctl status homeview
   ```

6. On each device that will cast, install and trust the Pi's public root certificate (`rootCA.pem`). Find its location with `mkcert -CAROOT` on the Pi and transfer only `rootCA.pem`; never share `rootCA-key.pem` or `homeview-key.pem`. Then open the Pi's HTTPS address in a browser with screen-sharing support. Certificate import steps vary by device; on Windows, use `certmgr.msc` and import under **Trusted Root Certification Authorities**.

The server listens on port 8000. If a firewall is enabled on the Pi, allow TCP port 8000 only from your home LAN. Do not configure router port forwarding. Keep the root CA private key and server private key on the Pi.

## Raspberry Pi static installation (no casting)

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

Homeview does not use accounts, cookies, analytics, or tracking scripts. It stores only your light/dark theme preference in localStorage in the browser you use to view the dashboard. The Python server is intended for a trusted local network. If weather coordinates are configured, the browser requests forecast data directly from Open-Meteo; this requires internet access. Quick links open in a new tab.

The Nginx setup above listens on the local network. Do not forward its port from your router unless you deliberately want to expose Homeview beyond your home.

## License

Homeview is released under the MIT License. See [LICENSE](LICENSE).
