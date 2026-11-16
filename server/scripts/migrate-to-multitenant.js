/*
 * One-time migration: moves data created before multi-company support
 * into a company, and creates that company's Owner account.
 *
 * Usage (from the server folder):
 *   npm run migrate:tenant -- --company "FitFuel Nutrition" --slug fitfuel \
 *       --name "Your Name" --email you@example.com --password "a-strong-password"
 *
 * Safe to re-run: records that already belong to a company are left alone.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Company = require("../models/Company");
const User = require("../models/User");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Activity = require("../models/Activity");
const FollowUp = require("../models/FollowUp");
const Feedback = require("../models/Feedback");
const Invite = require("../models/Invite");
const { slugify, checkSlug } = require("../services/authService");
const { getEmailDomain, isPublicDomain } = require("../utils/emailDomains");

const TENANT_MODELS = [Customer, Product, Sale, Activity, FollowUp, Feedback];

const parseArgs = () => {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
};

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

(async () => {
  const args = parseArgs();

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(`Connected to ${mongoose.connection.name}`);

  // Count records that don't belong to any company yet
  const orphanCounts = {};
  for (const Model of TENANT_MODELS) {
    orphanCounts[Model.modelName] = await Model.collection.countDocuments({
      company: { $exists: false },
    });
  }
  const totalOrphans = Object.values(orphanCounts).reduce((a, b) => a + b, 0);
  console.log("Records without a company:", orphanCounts);

  let company = null;

  if (totalOrphans > 0) {
    const companyName = String(args.company || "").trim();
    const email = String(args.email || "").trim().toLowerCase();
    if (!companyName || !args.name || !email || !args.password) {
      fail('Missing details. Pass --company "Name" --name "Your Name" --email you@x.com --password "..." (and optionally --slug).');
    }
    if (String(args.password).length < 8) fail("Password must be at least 8 characters.");

    const slug = String(args.slug || slugify(companyName)).toLowerCase();
    company = await Company.findOne({ slug });

    if (!company) {
      const slugCheck = await checkSlug(slug);
      if (!slugCheck.available) fail(`Company link "${slug}": ${slugCheck.reason}`);
      // Like sign-up: teammates with the owner's work domain can join from the link
      const domain = getEmailDomain(email);
      const domainFree =
        domain && !isPublicDomain(domain) && !(await Company.exists({ allowedDomains: domain }));
      company = await Company.create({ name: companyName, slug, allowedDomains: domainFree ? [domain] : [] });
      if (domainFree) console.log(`Teammates with @${domain} emails can sign up at /${slug}`);
      console.log(`Created company "${company.name}" (link: /${company.slug})`);
    } else {
      console.log(`Using existing company "${company.name}" (link: /${company.slug})`);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser && String(existingUser.company) !== String(company._id)) {
      fail(`${email} already belongs to another company.`);
    }
    if (!existingUser) {
      await User.create({
        company: company._id,
        name: String(args.name).trim(),
        email,
        passwordHash: await bcrypt.hash(String(args.password), 10),
        role: "Owner",
      });
      console.log(`Created Owner account ${email}`);
    }

    // Raw collection updates: the company field is immutable at the model level
    for (const Model of TENANT_MODELS) {
      const result = await Model.collection.updateMany(
        { company: { $exists: false } },
        { $set: { company: company._id } }
      );
      console.log(`  ${Model.modelName}: ${result.modifiedCount} record(s) moved into ${company.slug}`);
    }
  } else {
    console.log("Nothing to migrate.");
  }

  // Replace old global unique indexes (sku, orderNumber) with per-company ones
  for (const Model of [...TENANT_MODELS, Company, User, Invite]) {
    const dropped = await Model.syncIndexes();
    if (dropped.length) console.log(`  ${Model.modelName}: dropped old index(es) ${dropped.join(", ")}`);
  }
  console.log("Indexes are up to date.");

  if (company) {
    console.log(`\n✔ Done. Log in at /${company.slug} with ${String(args.email).toLowerCase()}\n`);
  }

  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
