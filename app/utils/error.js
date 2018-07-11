const nodemailer = require('nodemailer');
const config = require('../../config/index')

module.exports = {
  handleCriticalError: (message, body) => {
    const mailOptions = {
      from: config.email.admin_email,
      to: config.email.admin_email_text,
      subject: message,
      text: JSON.stringify(body)
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.username,
        pass: config.email.password
      }
    });

    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });

  }
}
