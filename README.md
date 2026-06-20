# GitHub Galaxy

GitHub Galaxy is a simple, visual website that turns a GitHub user's repositories into a starry galaxy. Each repository appears as a planet, and clicking a planet opens the repository page.

## Features

- Fetches public GitHub repositories for a specified user
- Displays each repository as a floating planet in a galaxy layout
- Uses random colors and motion to create a dynamic visual effect
- Clickable planets open the corresponding GitHub repository

## Demo

Open `Index.html` in a browser to view the galaxy visualization.

# Setup
## Method 1
1. Clone the repository or download the files.
2. Open `script.js`.
3. Replace `YOUR_GITHUB` in the fetch URL with the GitHub username you want to display.

Example:

```js
const response = await fetch(
  "https://api.github.com/users/YOUR_GITHUB/repos"
);
```

4. Save the file and open `Index.html` in your browser.
## Method 2
1. Go to the URL given in the description.
2. Type your GitHub username in the text box 

## Files

- `Index.html` — the main page that loads the galaxy
- `style.css` — galaxy background and planet styling
- `script.js` — repository fetching and planet animation logic

## Notes

- The site uses the public GitHub API, so rate limits may apply.
- This is a great starting point for a personal portfolio or GitHub visualizer.

