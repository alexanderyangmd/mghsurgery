# MGH Surgery Residents Portal

A modern web-based dashboard portal for MGH Surgery residents to access important information and resources.

## Features

- **On Call Schedule**: View and manage on-call schedules
- **Attending Preferences**: Access attending-specific guidelines and preferences
- **Useful Numbers**: Quick access to important contact information
- **Resources**: Educational materials and important documents

## Setup Instructions

1. Clone this repository to your local machine or web server
2. Add your MGH logo image as `mgh-logo.png` in the root directory
3. Customize the content in each section of `index.html` as needed
4. Deploy the files to your web server

## Technical Details

The portal is built using:
- HTML5
- CSS3 with modern features like CSS variables and Flexbox
- Vanilla JavaScript for interactivity
- [Remix Icon](https://remixicon.com/) for icons
- [Inter](https://fonts.google.com/specimen/Inter) font from Google Fonts

## Customization

### Colors
You can customize the color scheme by modifying the CSS variables in `styles.css`:
```css
:root {
    --primary-color: #003087;
    --secondary-color: #e51636;
    --background-color: #f5f6fa;
    --text-color: #2d3748;
}
```

### Content
Each section's content can be modified in the `index.html` file within the corresponding `<section>` elements.

## Browser Support

The portal is compatible with all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## Responsive Design

The portal is fully responsive and works well on:
- Desktop computers
- Tablets
- Mobile phones

## Contributing

To contribute to this project:
1. Fork the repository
2. Create a new branch for your feature
3. Submit a pull request with your changes

## License

This project is licensed under the MIT License. 