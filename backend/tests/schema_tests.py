"""Schema tests: run with  python3 schema_tests.py  (reads ../migrations/001_init.sql).
Tax slabs are inserted by the test only; the schema leaves tax_slabs empty."""
import os, sqlite3
c=sqlite3.connect(":memory:", isolation_level=None)
c.executescript(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","migrations","001_init.sql")).read())
c.execute("PRAGMA foreign_keys=ON")
fails=0; n=0
def run(label, sql, params=(), ok_expected=True, contains=None):
    global fails,n
    n+=1
    try: c.execute(sql, params); ok=True; msg=""
    except Exception as e: ok=False; msg=str(e)
    good=(ok==ok_expected) and (contains is None or ok or contains in msg)
    if not good: fails+=1
    print(("PASS " if good else "BAD  ")+label+("" if ok else "  -> "+msg))
def one(sql,p=()): return c.execute(sql,p).fetchone()
def booking(ref,status='confirmed',total=100000):
    c.execute("INSERT INTO bookings(reference,manage_token_hash,status,guest_name,guest_email,guest_phone,subtotal_paise,total_paise) VALUES (?,?,?,?,?,?,?,?)",(ref,'h',status,'G','g@x.in','1',total,total))
    return c.execute("select last_insert_rowid()").fetchone()[0]
rid=lambda num: one("select id from rooms where room_number=?",(num,))[0]
def stay(b,room,i,o,g=2,status='active'):
    extra = ",'2030-01-01T00:00:00Z'" if status=='cancelled' else ""
    cols = ",cancelled_at" if status=='cancelled' else ""
    return (f"INSERT INTO booking_rooms(booking_id,room_id,check_in_date,check_out_date,guests,nightly_rate_paise,status{cols}) VALUES (?,?,?,?,?,250000,?{extra})",(b,rid(room),i,o,g,status))
def bstatus(b): return one("select status from bookings where id=?",(b,))[0]

# ---------- settings incl. dinner defaults
print(one("select check_in_time,check_out_time,dinner_max_covers,dinner_price_per_person_paise from settings"))
run("checkout later than checkin","UPDATE settings SET check_out_time='15:00'",ok_expected=False)
run("negative dinner capacity","UPDATE settings SET dinner_max_covers=-1",ok_expected=False)

# ---------- overlap basics
A=booking('A'); run("A 202 16-18",*stay(A,202,'2030-01-16','2030-01-18'))
B=booking('B'); run("B 202 18-20 same-day turnover",*stay(B,202,'2030-01-18','2030-01-20'))
C=booking('C'); run("C 202 17-19 overlap",*stay(C,202,'2030-01-17','2030-01-19'),ok_expected=False,contains='already booked')
run("guests 3 > max",*stay(C,204,'2030-01-17','2030-01-19',3),ok_expected=False,contains='more guests')

# ---------- PARTIAL CANCELLATION
P=booking('P', total=200000)
run("P room 206 10-15 Feb",*stay(P,206,'2030-02-10','2030-02-15'))
run("P room 207 10-15 Feb",*stay(P,207,'2030-02-10','2030-02-15'))
Q=booking('Q')
run("Q wants 206 same dates -> blocked",*stay(Q,206,'2030-02-10','2030-02-15'),ok_expected=False)
run("cancel only room 206 of P (late fee 250000, cancelled_by guest)",
    "UPDATE booking_rooms SET status='cancelled', cancelled_at='2030-02-09T10:00:00Z', cancelled_by='guest', cancellation_fee_paise=250000 WHERE booking_id=? AND room_id=?",(P,rid(206)))
print("   P status after partial cancel:", bstatus(P))
assert bstatus(P)=='confirmed'
run("Q can now take 206",*stay(Q,206,'2030-02-10','2030-02-15'))
run("reinstate 206 on P (now taken)","UPDATE booking_rooms SET status='active', cancelled_at=NULL, cancelled_by=NULL, cancellation_fee_paise=0 WHERE booking_id=? AND room_id=?",(P,rid(206)),ok_expected=False,contains='already booked')
run("cancelled row needs cancelled_at",
    "UPDATE booking_rooms SET status='cancelled' WHERE booking_id=? AND room_id=?",(P,rid(207)) ,ok_expected=False,contains='CHECK constraint')

run("cancel last room 207 of P -> booking auto-cancelled",
    "UPDATE booking_rooms SET status='cancelled', cancelled_at='2030-02-09T10:05:00Z', cancelled_by='guest', cancellation_fee_paise=250000 WHERE booking_id=? AND room_id=?",(P,rid(207)))
print("   P status after last room cancelled:", bstatus(P)); assert bstatus(P)=='cancelled'
R=booking('R'); 
run("R 207 10-15 Feb after P cancelled",*stay(R,207,'2030-02-10','2030-02-15'))
run("reinstate booking P (207 taken) via row",
    "UPDATE booking_rooms SET status='active', cancelled_at=NULL, cancelled_by=NULL WHERE booking_id=? AND room_id=?",(P,rid(207)),ok_expected=True)  # booking P is cancelled -> trigger skipped
run("reinstate booking P status (207 taken)","UPDATE bookings SET status='confirmed' WHERE id=?",(P,),ok_expected=False,contains='no longer free')
run("put P row back to cancelled", "UPDATE booking_rooms SET status='cancelled', cancelled_at='x', cancelled_by='staff' WHERE booking_id=? AND room_id=?",(P,rid(207)))

# checked_in booking: cannot cancel a room
S=booking('S',status='checked_in'); run("S 209 20-25 Mar",*stay(S,209,'2030-03-20','2030-03-25'))
run("cancel row of checked_in booking","UPDATE booking_rooms SET status='cancelled', cancelled_at='x' WHERE booking_id=?",(S,),ok_expected=False,contains='shorten')
run("shorten checked_in stay instead","UPDATE booking_rooms SET check_out_date='2030-03-23' WHERE booking_id=?",(S,))

# booking-level cancel in either order works
T=booking('T'); run("T 211 1-4 Apr",*stay(T,211,'2030-04-01','2030-04-04'))
run("T booking cancelled first","UPDATE bookings SET status='cancelled' WHERE id=?",(T,))
run("then its row","UPDATE booking_rooms SET status='cancelled', cancelled_at='x', cancelled_by='staff', cancellation_fee_paise=250000 WHERE booking_id=?",(T,))

# room guards ignore cancelled rows, respect active ones
run("out_of_service 211 (only cancelled stays)","UPDATE rooms SET status='out_of_service' WHERE room_number=211")
run("out_of_service 202 with active future stays","UPDATE rooms SET status='out_of_service' WHERE room_number=202",ok_expected=False,contains='move them first')
run("reactivate 211","UPDATE rooms SET status='active' WHERE room_number=211")
c.execute("UPDATE rooms SET status='out_of_service' WHERE room_number=211")
run("book while out_of_service",*stay(booking('V'),211,'2030-05-01','2030-05-03'),ok_expected=False,contains='out of service')
c.execute("UPDATE rooms SET status='active' WHERE room_number=211")

# ---------- views after partial cancellation
c.execute("INSERT INTO payments(booking_id,amount_paise,method,status,completed_at) VALUES (?,100000,'cash','completed','2030-02-01T10:00:00Z')",(Q,))
# partial-cancel scenario: booking W with two rooms, one cancelled late with fee, money recomputed for active room only
W=booking('W',total=250000)
c.execute(*stay(W,203,'2030-06-10','2030-06-11'))
c.execute(*stay(W,208,'2030-06-10','2030-06-11'))
c.execute("UPDATE booking_rooms SET status='cancelled', cancelled_at='2030-06-09T00:00:00Z', cancelled_by='guest', cancellation_fee_paise=250000 WHERE booking_id=? AND room_id=?",(W,rid(208)))
c.execute("UPDATE bookings SET subtotal_paise=250000,total_paise=250000 WHERE id=?",(W,))
print("v_booking_summary W:", one("select reference,status,check_in_date,check_out_date,nights,rooms,cancelled_rooms,cancellation_fees_paise,amount_due_paise,paid_paise,balance_paise from v_booking_summary where reference='W'"))
assert one("select rooms,cancelled_rooms,amount_due_paise from v_booking_summary where reference='W'")==(1,1,500000)
print("v_booking_summary T (fully cancelled):", one("select status,check_in_date,check_out_date,rooms,cancelled_rooms,amount_due_paise from v_booking_summary where reference='T'"))
print("v_room_stays 208:", c.execute("select room_number,stay_status,reference from v_room_stays where room_number=208").fetchall())

# ---------- DINNER
run("dinner while closed (capacity 0)","INSERT INTO dinner_bookings(reference,dinner_date,dinner_time,party_size,guest_name,guest_phone,price_per_person_paise,subtotal_paise,total_paise) VALUES ('D0','2030-01-20','19:00',2,'Asha','999',55000,110000,110000)",ok_expected=False,contains='fully booked')
c.execute("UPDATE settings SET dinner_max_covers=10")
def dinner(ref,date,party,time='19:00',booking_id=None,name='Asha',phone='999',price=55000,status='confirmed'):
    return ("INSERT INTO dinner_bookings(reference,booking_id,status,dinner_date,dinner_time,party_size,guest_name,guest_phone,price_per_person_paise,subtotal_paise,total_paise) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (ref,booking_id,status,date,time,party,name if booking_id is None else None,phone if booking_id is None else None,price,price*party,price*party))
run("dinner 6 covers",*dinner('D1','2030-01-20',6))
run("dinner +4 = 10 (full)",*dinner('D2','2030-01-20',4,'20:00'))
run("dinner +1 over capacity",*dinner('D3','2030-01-20',1),ok_expected=False,contains='fully booked')
run("other date fine",*dinner('D4','2030-01-21',3))
run("linked to room booking, no contact",*dinner('D5','2030-01-21',2,booking_id=A))
run("standalone needs contact",*dinner('D6','2030-01-22',2,name=None,phone=None),ok_expected=False,contains='CHECK constraint')
run("subtotal mismatch","INSERT INTO dinner_bookings(reference,dinner_date,dinner_time,party_size,guest_name,guest_phone,price_per_person_paise,subtotal_paise,total_paise) VALUES ('D7','2030-01-22','19:00',2,'a','1',55000,1,1)",ok_expected=False,contains='CHECK constraint')
run("bad time","INSERT INTO dinner_bookings(reference,dinner_date,dinner_time,party_size,guest_name,guest_phone,price_per_person_paise,subtotal_paise,total_paise) VALUES ('D8','2030-01-22','7pm',1,'a','1',55000,55000,55000)",ok_expected=False)
D1=one("select id from dinner_bookings where reference='D1'")[0]
run("cancel D1 frees 6 covers","UPDATE dinner_bookings SET status='cancelled', cancelled_at='x' WHERE id=?",(D1,))
run("now +3 fits",*dinner('D9','2030-01-20',3))
run("reinstate D1 (would exceed)","UPDATE dinner_bookings SET status='confirmed', cancelled_at=NULL WHERE id=?",(D1,),ok_expected=False,contains='fully booked')
run("raise party size past capacity","UPDATE dinner_bookings SET party_size=9, subtotal_paise=495000, total_paise=495000 WHERE reference='D9'",ok_expected=False,contains='fully booked')

# payments: exactly one target
run("payment with both targets","INSERT INTO payments(booking_id,dinner_booking_id,amount_paise,method) VALUES (?,?,100,'cash')",(A,D1),ok_expected=False,contains='CHECK constraint')
run("payment with no target","INSERT INTO payments(amount_paise,method) VALUES (100,'cash')",ok_expected=False,contains='CHECK constraint')
run("dinner payment",("INSERT INTO payments(dinner_booking_id,amount_paise,method,status,completed_at) VALUES (?,110000,'cash','completed','2030-01-20T20:00:00Z')"),(one("select id from dinner_bookings where reference='D2'")[0],))
print("v_dinner_summary:", c.execute("select reference,status,party_size,guest_name,booking_reference,amount_due_paise,paid_paise,balance_paise from v_dinner_summary order by id").fetchall()[:6])

# ---------- dinner cancellation rules
run("dinner on a cancelled room booking",*dinner('D10','2030-01-23',2,booking_id=P),ok_expected=False,contains='cancelled')
run("dinner on a live room booking",*dinner('D11','2030-01-23',2,booking_id=A))
D11=one("select id from dinner_bookings where reference='D11'")[0]
run("late cancel: fee = full total","UPDATE dinner_bookings SET status='cancelled', cancelled_at='x', cancelled_by='staff', cancellation_fee_paise=110000 WHERE id=?",(D11,))
run("fee above total","UPDATE dinner_bookings SET cancellation_fee_paise=110001 WHERE id=?",(D11,),ok_expected=False,contains='CHECK constraint')
due=one("select amount_due_paise,cancellation_fee_paise from v_dinner_summary where reference='D11'")
print("cancelled dinner owes:",due); assert due==(110000,110000)
run("reinstate dinner after its room booking is cancelled",
    "UPDATE bookings SET status='cancelled' WHERE id=?",(A,))
run("  -> dinner back to confirmed refused","UPDATE dinner_bookings SET status='confirmed', cancelled_at=NULL, cancelled_by=NULL, cancellation_fee_paise=0 WHERE id=?",(D11,),ok_expected=False,contains='cancelled')
run("settings: negative dinner cancellation hours","UPDATE settings SET dinner_cancellation_hours=-1",ok_expected=False)
run("settings: dinner cancellation 24h","UPDATE settings SET dinner_cancellation_hours=24")

# ---------- combined billing: room booking + linked dinner = ONE payment
K=booking('K', total=500000)
run("K room 203, 10-12 Jul",*stay(K,203,'2030-07-10','2030-07-12'))
run("K linked dinner for 2",*dinner('KD','2030-07-10',2,booking_id=K))
KD=one("select id from dinner_bookings where reference='KD'")[0]
sK=one("select amount_due_paise,dinners_due_paise,paid_paise,balance_paise from v_booking_summary where reference='K'")
print("K before payment:",sK); assert sK==(610000,110000,0,610000)
run("one gateway payment covers room + dinner","INSERT INTO payments(booking_id,amount_paise,method,status,gateway_reference,completed_at) VALUES (?,610000,'online','completed','cf_123','2030-07-01T10:00:00Z')",(K,))
sK=one("select paid_paise,balance_paise from v_booking_summary where reference='K'"); assert sK==(610000,0), sK
run("payment aimed at the linked dinner refused","INSERT INTO payments(dinner_booking_id,amount_paise,method) VALUES (?,110000,'cash')",(KD,),ok_expected=False,contains='billed with its room booking')
vd=one("select billed_with_booking,balance_paise from v_dinner_summary where reference='KD'"); print("linked dinner view:",vd); assert vd==(1,None)
vs=one("select billed_with_booking,balance_paise from v_dinner_summary where reference='D2'"); assert vs==(0,110000), vs   # standalone 4-guest dinner (220000), half paid: balance is its own

# attaching a standalone dinner to a room booking
run("attach unpaid standalone dinner D4 to live booking Q","UPDATE dinner_bookings SET booking_id=? WHERE reference='D4'",(Q,))
run("attach D2 (has its own payment) refused","UPDATE dinner_bookings SET booking_id=? WHERE reference='D2'",(Q,),ok_expected=False,contains='own payments')
run("attach D9 to a cancelled booking refused","UPDATE dinner_bookings SET booking_id=? WHERE reference='D9'",(P,),ok_expected=False,contains='cancelled')

# late cancellation of the whole combined booking: room fee 1 night + dinner no-return, paid money exceeds -> refund due
run("cancel K's only room (late fee 1 night) -> booking auto-cancelled",
    "UPDATE booking_rooms SET status='cancelled', cancelled_at='2030-07-09T00:00:00Z', cancelled_by='guest', cancellation_fee_paise=250000 WHERE booking_id=?",(K,))
assert bstatus(K)=='cancelled'
run("K's dinner cancelled, no returns (fee = total)","UPDATE dinner_bookings SET status='cancelled', cancelled_at='2030-07-09T00:00:00Z', cancelled_by='guest', cancellation_fee_paise=110000 WHERE id=?",(KD,))
sK=one("select amount_due_paise,paid_paise,balance_paise from v_booking_summary where reference='K'")
print("K after late cancel (due, paid, balance):",sK); assert sK==(360000,610000,-250000)   # negative = refund owed to guest

# ---------- TAX fixture (test-only; production table stays empty)
c.executescript("INSERT INTO tax_slabs(label,from_nightly_paise,rate_bp) VALUES ('GST 0%',0,0),('GST 5%',100001,500),('GST 18%',750001,1800)")
look=lambda rs: one("SELECT label,rate_bp FROM tax_slabs WHERE from_nightly_paise<=? ORDER BY from_nightly_paise DESC LIMIT 1",(round(rs*100),))
print("tax lookups:", {rs:look(rs)[0] for rs in (1000,1000.01,3500,7500,7500.01,9000)})
# per-room tax for a mixed booking at fixture rates: suite 9000, twin 2500, one night each
tot=0
for rate in (9000,2500):
    _,bp=look(rate); tot+=rate*100*bp//10000
print("mixed booking GST (paise):", tot, "= suite 18% 162000 + twin 5% 12500")
assert tot==162000+12500
print(f"\n{n} cases, FAILS: {fails}")
