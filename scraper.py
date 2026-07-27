import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
import time

def scrape_imdb():
    print("Opening IMDb Top 250...")

    options = Options()
    options.add_argument("--window-size=1920,1080")

    # IMPORTANT: keep browser visible
    # options.add_argument("--headless=new")

    driver = webdriver.Chrome(options=options)

    try:
        driver.get("https://www.imdb.com/chart/top/")
        time.sleep(8)

        movies = []

        # NEW SAFE METHOD: grab all links inside page
        elements = driver.find_elements(By.TAG_NAME, "a")

        rank = 1

        for el in elements:
            try:
                text = el.text.strip()

                # filter only movie titles (ignore empty text)
                if text and len(text) > 10 and "." in text:
                    movies.append({
                        "rank": rank,
                        "title": text
                    })

                    print(f"{rank}. {text}")
                    rank += 1

                if rank > 250:
                    break

            except:
                continue

        pd.DataFrame(movies).to_csv("imdb_top250.csv", index=False)

        print(f"\nSaved {len(movies)} movies!")

    finally:
        driver.quit()

if __name__ == "__main__":
    scrape_imdb()