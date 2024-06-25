const joi = require("joi");

const registerSchema = joi.object({
  name: joi.string().min(3).required(),
  mobile: joi.string().required(),
  country_code: joi.string().required(),
  dob: joi.string().required(),
  gender: joi.string().required(),
  looking_for: joi.string().required(),
  image: joi.string().default("NULL"),
});

const profileSchema = joi.object({
  name: joi.string().min(3).required(),
  dob: joi.string().required(),
  gender: joi.string().required(),
  about: joi.string().default("NULL").empty(""),
});

const locationSchema = joi.object({
  latitude: joi.string().required(),
  longitude: joi.string().required(),
  city: joi.string().required(),
  country: joi.string().required(),
});

module.exports = { registerSchema, profileSchema, locationSchema };
