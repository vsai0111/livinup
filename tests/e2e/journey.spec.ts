import { expect, test, type Page } from '@playwright/test'
import sharp from 'sharp'

/**
 * The v1 journey, end to end, against a real server and database:
 *
 *   landing -> sign up (18+, terms) -> onboarding -> wardrobe (photo upload and
 *   a piece without a photo) -> outfit (saree + blouse) -> publish -> the post
 *   is public, the wardrobe photo is not -> delete the account.
 *
 * Runs on desktop Chrome and a Pixel 7, so the mobile drawer is covered too.
 */

const PASSWORD = 'correct-horse-battery-staple'

function unique(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}

async function goViaNav(page: Page, name: string): Promise<void> {
  const menu = page.getByRole('button', { name: 'Open menu' })
  if (await menu.isVisible()) await menu.click()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name, exact: true })
    .click()
}

/** Colour swatches are labels around a visually hidden radio: click what people click. */
async function pickColour(page: Page, colour: string): Promise<void> {
  await page.getByRole('dialog').locator(`label[title="${colour}"]`).first().click()
  await expect(page.getByRole('radio', { name: colour }).first()).toBeChecked()
}

async function photo(): Promise<Buffer> {
  return sharp({
    create: { width: 600, height: 750, channels: 3, background: { r: 123, g: 35, b: 54 } },
  })
    .jpeg()
    .toBuffer()
}

test('landing page describes the wardrobe product, not shopping', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your wardrobe.')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your next look.')
  const text = (await page.locator('main').innerText()).toLowerCase()
  // Whole words, so "ideal" does not count as "deal".
  for (const retired of [
    /\bdeals?\b/,
    /\bprice drops?\b/,
    /\badd to cart\b/,
    /\bai styling\b/,
    /\bstylist booking\b/,
  ]) {
    expect(text).not.toMatch(retired)
  }
})

test('sign-up requires the 18+ and terms confirmations', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Email address').fill(`e2e-${unique()}@livinup.test`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  // Native validation or the server: either way the account is not created.
  await expect(page).toHaveURL(/\/signup/)
})

test('retired shopping URLs redirect instead of 404ing', async ({ page }) => {
  await page.goto('/search?q=linen')
  await expect(page).toHaveURL(/\/(signin|home)/)
})

test('wardrobe to public post, privacy, and account deletion', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const id = unique()
  const username = `e2e${id}`.slice(0, 24)

  // --- Sign up -------------------------------------------------------------
  await page.goto('/signup')
  await page.getByLabel('Email address').fill(`e2e-${id}@livinup.test`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByLabel('I am 18 or older.').check()
  await page.getByLabel(/I agree to the/).check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)

  // --- Onboarding ----------------------------------------------------------
  await expect(page.getByRole('heading', { name: 'Set up your profile' })).toBeVisible()
  await page.getByLabel('Display name').fill('Asha E2E')
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Add a few things you own' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await expect(page.getByRole('heading', { name: 'Follow people and brands' })).toBeVisible()
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page).toHaveURL(/\/home/)

  // --- Wardrobe: a photographed saree -------------------------------------
  await goViaNav(page, 'Wardrobe')
  await expect(page.getByRole('heading', { name: 'Wardrobe', level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Add pieces', exact: true }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'saree.jpg', mimeType: 'image/jpeg', buffer: await photo() })
  await page.getByRole('dialog').getByLabel('Type').selectOption('saree')
  await pickColour(page, 'Maroon')
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill('Banarasi saree')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('1 piece added to your wardrobe.')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Done' }).click()

  // --- Wardrobe: a blouse without a photo ---------------------------------
  await page.getByRole('button', { name: 'Add without photo' }).click()
  await page.getByRole('dialog').getByLabel('Type').selectOption('blouse')
  await pickColour(page, 'Gold')
  await page.getByRole('dialog').getByRole('textbox', { name: 'Name' }).fill('Gold blouse')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(page.getByText('Banarasi saree').first()).toBeVisible()
  await expect(page.getByText('Gold blouse').first()).toBeVisible()

  // The wardrobe photo URL, for the privacy check later.
  const wardrobeImage = await page.locator('img[src^="/media/"]').first().getAttribute('src')
  expect(wardrobeImage).toBeTruthy()

  // --- Outfit: saree + blouse is valid ------------------------------------
  await page.goto('/outfits/new')
  const pieces = page.getByRole('region', { name: 'Your pieces' })
  await pieces.getByRole('button', { name: /Banarasi saree/ }).click()
  await pieces.getByRole('button', { name: /Gold blouse/ }).click()
  // Saree + blouse is a valid look: both stay on the board.
  const board = page.getByRole('region', { name: 'Outfit board' })
  await expect(board.getByRole('button', { name: /^Remove / })).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Name' }).fill('Diwali evening')
  await page.getByRole('button', { name: 'Save outfit' }).click()
  await expect(page).toHaveURL(/\/outfits\/[0-9a-f-]{36}/)

  // --- Publish ------------------------------------------------------------
  await page.getByRole('link', { name: 'Share as post' }).click()
  await expect(page).toHaveURL(/\/create\?outfit=/)
  // Sharing an outfit preselects its photographed pieces. Clicking the saree
  // here would take it back out, so only check it is already selected.
  await expect(page.getByRole('button', { name: 'Banarasi saree' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByLabel('Caption').fill('Diwali at home')
  await page.getByRole('button', { name: 'Festive' }).click()
  await page.getByLabel('Description for photo 1').fill('Maroon Banarasi saree')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.getByText('This is exactly what will be public.')).toBeVisible()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}/)
  const postUrl = new URL(page.url()).pathname
  await expect(page.getByText('Diwali at home')).toBeVisible()

  // --- Signed out: the post is public, the wardrobe photo is not ----------
  const visitor = await browser.newContext()
  const anon = await visitor.newPage()
  await anon.goto(postUrl)
  await expect(anon.getByText('Diwali at home')).toBeVisible()
  const postImage = await anon.locator('img[src^="/media/"]').first().getAttribute('src')
  expect(postImage).toBeTruthy()
  expect(postImage).not.toBe(wardrobeImage)
  expect((await anon.request.get(postImage!)).status()).toBe(200)
  expect((await anon.request.get(wardrobeImage!)).status()).toBe(404)
  await anon.goto(`/u/${username}`)
  await expect(anon.getByRole('heading', { name: /Asha E2E/ })).toBeVisible()
  await anon.goto('/wardrobe')
  await expect(anon).toHaveURL(/\/signin/)
  await visitor.close()

  // --- Delete the account -------------------------------------------------
  await page.goto('/settings')
  await page.getByLabel(`Type @${username} to confirm`).fill(`@${username}`)
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page).toHaveURL(/\/account-deleted/)

  await expect(page.getByRole('heading', { name: 'Your account has been deleted' })).toBeVisible()

  // The post, its public image and the profile are gone for everyone.
  const after = await browser.newContext()
  const check = await after.newPage()
  await check.goto(postUrl)
  await expect(check.getByRole('heading', { name: 'This post isn’t available' })).toBeVisible()
  await expect(check.getByText('Diwali at home')).toHaveCount(0)
  expect((await check.request.get(postImage!)).status()).toBe(404)
  await check.goto(`/u/${username}`)
  await expect(check.getByRole('heading', { name: 'This account isn’t available' })).toBeVisible()
  await after.close()

  // And the account cannot sign in again.
  await page.goto('/signin')
  await page.getByLabel('Email address').fill(`e2e-${id}@livinup.test`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/signin/)
})
