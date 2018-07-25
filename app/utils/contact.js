const nodemailer = require('nodemailer');
const config = require('../../config/index')

async function sendEmail(name, email, message) {
  if (process.env.NODE_ENV === 'production') {
    const body = [
      `<b>Name:</b> ${name}`,
        `<b>Email:</b> ${email}`,
      `<b>Message:</b><br/> ${message}`
    ]
    const mailOptions = {
      from: config.contact_email.from,
      to: config.contact_email.to,
      replyTo: email,
      subject: `iamspacecake.com new message from ${name}`,
      html: JSON.stringify(body.join('<br/><br/>'))
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.contact_email.username,
        pass: config.contact_email.password
      }
    });

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
        throw error;
      } else {
        console.log('Email sent: ' + info.response);
        return info.response;
      }
    });
  }
}

module.exports = {
  sendMessage: async function (req, res) {
    try {
      const { name, email, message } = req.body
      const response = await sendEmail(name, email, message)
      res.statusCode = 200
      res.json({
        success: true,
        response,
      });
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error })
    }
  },
}
