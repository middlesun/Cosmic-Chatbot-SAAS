# 🚀 Contact Form Blaster - Chrome Extension

An intelligent Chrome extension for large-scale outreach campaigns that automatically fills and submits contact forms across multiple websites using your custom data. Powered by AI for intelligent field matching and form analysis.

## ✨ Features

### 🎯 **Custom Data Management**
- **Personal Contact Data**: Enter your name, email, phone, company, website, and custom messages
- **Data Templates**: Save and load multiple contact data templates for different campaigns
- **Intelligent Field Matching**: AI automatically maps your data to the right form fields

### 🚫 **URL Suppression System**
- **Suppression List**: Add URLs to skip during campaigns (prevents duplicate submissions)
- **Auto-Suppression**: Automatically adds submitted URLs to prevent accidental re-submissions
- **Smart URL Matching**: Supports domain-level and exact URL matching

### 🤖 **AI-Powered Intelligence**
- **Smart Form Analysis**: Uses DeepSeek AI to understand form context and field types
- **Intelligent Field Mapping**: Automatically matches your data to form fields using semantic analysis
- **Context-Aware Filling**: Adapts to different types of forms (contact, registration, inquiry, etc.)

### 📊 **Campaign Management**
- **Single Form Blasting**: Right-click any page to blast a single form
- **Mass Outreach Campaigns**: Test all forms across multiple tabs automatically
- **Real-time Progress Tracking**: Visual progress indicators and status updates
- **Comprehensive Reporting**: Detailed success/failure reports with export functionality

### 🔧 **Advanced Features**
- **Data Source Selection**: Choose between custom data or AI-generated test data
- **Keyboard Shortcuts**: Quick form blasting with Ctrl+Shift+T
- **Form Submission**: Optional automatic form submission after filling
- **Security Features**: Skips file uploads and password fields for safety

## 🛠️ Installation

### Option 1: Manual Installation (Recommended)

1. **Download the Extension**
   - Clone or download this repository
   - Extract the files to a folder on your computer

2. **Enable Developer Mode**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Select the `Tool-Tester-Plugin` folder
   - The extension should now appear in your Chrome toolbar

### Option 2: Chrome Web Store
*Coming soon...*

## 🔧 Setup & Configuration

### 1. Get Your OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai)
2. Sign up for a free account
3. Navigate to the API Keys section
4. Generate a new API key
5. Copy the key (you'll need it for the extension)

### 2. Configure Your Contact Data

1. Click the Contact Form Blaster icon in Chrome toolbar
2. Go to the "Data" tab
3. Enter your contact information:
   - **Full Name**: Your name for form submissions
   - **Email Address**: Your email for contact forms
   - **Phone Number**: Your phone number
   - **Company/Organization**: Your business name
   - **Website**: Your website URL
   - **Default Message**: Your standard outreach message
   - **Default Subject**: Your standard email subject

### 3. Set Up URL Suppression

1. In the "Data" tab, scroll to "URL Suppression List"
2. Add URLs you want to skip (one per line)
3. Enable "Auto-suppression" to automatically add submitted URLs
4. Click "Save Suppression List"

### 4. Configure API Key

1. Go to the "Setup" tab
2. Enter your OpenRouter API key
3. Click "Save API Key"

## 🎯 How to Use

### Quick Start - Single Form Blasting

1. **Navigate to a Contact Form**
   - Go to any website with a contact form
   - Make sure you're on the page with the form

2. **Blast the Form**
   - Right-click anywhere on the page
   - Select "Blast Form" from the context menu
   - Or press `Ctrl+Shift+T` (Windows) / `Cmd+Shift+T` (Mac)
   - Watch the progress indicator as it fills and submits the form

### Mass Outreach Campaigns

1. **Open Multiple Target Websites**
   - Open tabs with websites you want to contact
   - Each tab should have a contact form

2. **Start Campaign**
   - Click the Contact Form Blaster extension icon
   - Go to the "Test" tab
   - Click "Start Mass Outreach Campaign"
   - Watch as it processes each website automatically

3. **Monitor Progress**
   - Real-time progress updates show current website being processed
   - Success indicators appear when forms are completed
   - Check the "Results" tab for detailed reports

### Data Templates

1. **Save a Template**
   - Fill in your contact data in the "Data" tab
   - Enter a template name (e.g., "Business Outreach")
   - Click "Save Template"

2. **Load a Template**
   - Select a saved template from the dropdown
   - Click "Load Template"
   - Your contact data will be populated automatically

3. **Switch Between Campaigns**
   - Create different templates for different purposes
   - Business outreach, personal networking, etc.

## 📊 Understanding Results

### Success Indicators
- ✅ **Green checkmark**: Form submitted successfully
- **Forms count**: Shows successful vs. total forms
- **Fields filled**: Number of fields successfully filled

### Failure Indicators
- ❌ **Red X**: Form submission failed
- **Error messages**: Specific reasons for failures
- **Suppressed URLs**: URLs skipped due to suppression list

### Campaign Reports
Each result includes:
- Website title and URL
- Number of forms found and processed
- Fields filled vs. skipped
- Success/failure status
- Specific error messages
- Timestamp of submission

## 🔒 Privacy & Security

- **Local Data Storage**: Your contact data is stored locally in your browser
- **No Data Collection**: The extension doesn't collect or transmit your personal data
- **Secure API**: Communication with OpenRouter is encrypted
- **URL Suppression**: Prevents accidental duplicate submissions
- **Skip Sensitive Fields**: Automatically skips file uploads and password fields

## 🚨 Important Notes

- **Use Responsibly**: Only contact websites you have legitimate business with
- **Respect Rate Limits**: Be mindful of website terms of service and API usage limits
- **Real Submissions**: The extension makes real form submissions - use with caution
- **No Guarantee**: Some forms may not work due to security measures or CAPTCHA

## 📈 Supported Form Types

The extension works with most standard contact forms:
- Contact forms
- Inquiry forms
- Quote request forms
- Registration forms
- Newsletter signups
- Feedback forms
- Support request forms
- And many more...

## 🔄 Data Source Modes

### Custom Data Mode (Default)
- Uses your own contact information
- Perfect for real outreach campaigns
- Intelligent field matching with your data

### AI Test Data Mode
- Generates realistic test data using AI
- Useful for testing form functionality
- Not recommended for real outreach

## 🤝 Best Practices

### For Outreach Campaigns
1. **Personalize Your Message**: Create compelling, relevant outreach messages
2. **Use Multiple Templates**: Different messages for different types of businesses
3. **Monitor Suppression List**: Keep track of contacted websites
4. **Follow Up**: Use the results to track responses and follow up appropriately

### For Testing
1. **Start Small**: Test on a few websites first
2. **Check Results**: Review the detailed reports
3. **Adjust Settings**: Fine-tune based on your needs

## 🔧 Troubleshooting

### Common Issues

**"API key not configured"**
- Make sure you've entered your OpenRouter API key
- Verify the key is correct and active
- Check your OpenRouter account has free credits

**"URL is in suppression list"**
- The website was previously contacted
- Remove from suppression list if you want to contact again
- Check the suppression list in the "Data" tab

**"Form submission failed"**
- The website might have CAPTCHA protection
- Some forms require human verification
- Network issues or server problems

**Extension not working**
- Refresh the page and try again
- Check browser console for error messages
- Ensure Chrome is up to date

### Getting Help

If you encounter issues:
1. Check the browser console for error messages
2. Try testing on simple websites first
3. Verify your API key is working
4. Make sure the extension has necessary permissions

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **OpenRouter**: For providing AI API access
- **DeepSeek**: For the powerful language model
- **Chrome Extension API**: For the robust extension framework

---

**Happy Outreach!** 🎉

For support or questions, please open an issue in the repository. 