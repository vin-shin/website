# Context
Owen asked me to fill out the supplier pricing (price break) table and correct the SKU field for many(30+) supplier parts we(me and Jason) have added to PO-0007 and PO-0008 for the URCA HITL mock card PCB.
Since there are so many stuff to update and Inventree's UI is quite annoying to work with, I decided to write a Python script to automate this process.
I first wrote a short script (no it's not vibe coded) to enumerate through every part in PO-0007. For each part, fetch relevant data from Digikey using the link in the Digikey link specified in the supplier part. Update the SKU to the Digikey part number, and populate the pricing table on inventree.
This part worked out just fine without any incident, and in total 338 pricing table entries has been automatically filled out (which would take forever to do by hand).
# Start of the trouble
After the pricing table for the supplier parts are populated, I saw that Inventree didn't automatically update the price fields in the purchase requests. And even though I found out that I can force Inventree to update the price fields by changing the currency to something other than USD and then changing it back to USD, doing this to each PO entry manually would still be a pain.
So, I figured I would just quickly write a few lines of Python to take care of this, annnd this is where the trouble started.
Here's the relevant lines of code in my script:
```python
...

resp = inventree_client.get("https://inventree.gauchoracing.com/api/order/po-line/?order=7&part_detail=true").raise_for_status()
for it in resp.json():
    part = it["part"]
    for cu in ["CNY", "USD"]:
        inventree_client.patch(
            f"https://inventree.gauchoracing.com/api/order/po-line/{part}/",
            data={
                "auto_pricing": True,
                "order": 7,
                "part": part,
                "purchase_price_currency": cu
            }
        )
```
With this script I intended to automate the procedure of changing each entry to CNY then back to USD to trigger an recalculation of the price fields. And I didn't think this could cause any trouble since in my mind it would at most mess up some currency settings and/or leave some entries not updated.
Actually, in my initial attempt, `data` did not include `"order": 7` and  `"part": part`, but that didn't work (I forgot exactly why it didn't work, but I don't want to test it again for obvious reasons). So then I added these fields, and ran the script again...
It seemed to work initially. I saw a few 404s flying by in the console, but prices seemed to be updated just fine. So I also ran this on order 8.
But then, a closer look at PO-0007 and 0008 revealed the mess that the script has made... Initially, I saw that PO-0007 have a total price of close to $800. I looked through the entries and found that a component which should have a order quantity of 25 have somehow changed to 120. And PO-0008 is reporting 0 entries despite showing a $10.xx total price.
# Cause
The root cause is just 4 wrong characters in the script (in `part = it["part"]`)... Inventree have a ID for each object (PO entry, part, supplier part, etc.) that's unique within that type of objects, these are called `pk`(primary key I guess?). In my script, I wanted to send HTTP PATCH requests for each PO entry. I started by fetching the list of entries in the PO. Then, what I should've done is iterate through the entries and use the `pk` value of each entry to make PATCH requests to toggle their currency settings. But what I did instead of use the `part` value of the entries, which actually contained the `pk` value of the parts, not the PO entries. Thus, what ended up happening is that I made PATCH requests for each PO entry in the PO with a `pk` value that happened to match one of the `pk` values of one of the supplier parts in the PO. And more importantly, I force-updated the assigned part of the PO entries that were affected to be the part with `pk` equal to the PO entry's `pk`. Because Inventree apparently does not do any sanity check of the data in PATCH requests, I also force-updated the `order` fields to `7`, which got some entries that were originally in other order requests (not PO-0007) into a invalid state.
# Fix
Initially, I had an idea for restoring all the data that got overridden -- because my script looped through the PO entries reported by Inventree in sequence. I could know the correct sequence of supplier part `pk` values by looking at Inventree's log, which contained the URL (but unfortunately no data) of the requests, which contained the supplier part `pk` that was used in my script's requests instead of PO entry `pk`s. And then, if the sequence of PO entries didn't change, I could just map this sequence of supplier parts to the sequence of PO entries and fix everything.
But it looks like the sequence did change for whatever reason -- I can not see a clear match between the two sequences. So this turned out to be an dead end.
Very fortunately, because the nature of the fuckup was that my script used the supplier part `pk`s as the PO entry `pk`s, the earlier PO entries made by others in the GR team did not get messed up because they were created earlier and had a small `pk` value which the supplier part `pk`s missed. This saved the first 6 entries in PO-0007 from my fuckup. Then, by looking at the data it was pretty easy to recover the 7th entry in PO-0007 using some logic (partially thanks to it being the only entry in PO-0007 that had a note which was "andrey led", fun fact). And the 7th entry happened to be the last entry that was not created by me.
As of all the other entries in PO-0007 and PO-0008 that were created by me (and Jason), I was able to recreated them easily thanks to the [Manufacturing Build Order](https://inventree.gauchoracing.com/web/manufacturing/build-order/3/line-items) that we created for our PCB.
# Conclusion
Overall, this was a... interesting... learning experience for me -- unexpectedly causing a genuine fuckup in prod, but in the end being able to resolve it without losing any important data and without causing too much trouble for others. Thanks to the GR team for being supportive during this whole ordeal.
So... I think the lesson is clear, **never** run untested scripts on prod, even if you can't think of anyway that it could cause trouble.
And... Maybe we should consider improving the Inventree system to include more "official" automations. (e.g. automatically import Digikey parts from a link) So that we do not have to do risky work on prod to avoid hours of manual error-prone labor...