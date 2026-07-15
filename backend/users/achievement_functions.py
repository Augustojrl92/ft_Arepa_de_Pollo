
def dios_de_las_arepas_completion_check(user):
	if user.completion_date != None:
		return True
	completed = user.user.coalition_name.lower() == 'Marventis'.lower()
	user.progress = int(completed)
	return completed
