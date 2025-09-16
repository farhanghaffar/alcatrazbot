const allowedOrigins = [
  //Twickly Local and Deployed
  "http://localhost:3000",
  "https://www.twickly.com",
  "https://alcatraz-dashboard.vercel.app",
  //WP SITES
  "https://www.statueticketing.com",
  "https://www.alcatrazticketing.com",
  "http://potomacticketing.com",
  "https://baycruisetickets.com",
  "http://bostoncruisetickets.com",
  "https://niagaracruisetickets.com",
  "https://fortsumterticketing.com",

  "https://battleshiptickets.com",
  "https://hooverdamticketing.com",
  "https://mackinacticketing.com",
  "https://plantationtickets.com",
  "https://shipislandferry.com",
];

export const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};
