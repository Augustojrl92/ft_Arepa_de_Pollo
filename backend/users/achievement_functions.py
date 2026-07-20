
from .models import Achievement

def set_up_achievements():
	altarian_achievement_name = "La respuesta a la vida, al universo, y a todo lo demás."
	Achievement.completion_check_funcs[altarian_achievement_name] = altarians_completion
	create_achievement_if_unexistant(altarian_achievement_name, "Consigue 420 Altarians.", 420)

	evaluation_points_achievement_name = "Claro que te evalúo!"
	Achievement.completion_check_funcs[evaluation_points_achievement_name] = evaluation_points_completion
	create_achievement_if_unexistant(evaluation_points_achievement_name, "Ten 42 puntos de evaluación", 42)

	senior_achievement_name = 'Helping with the war effort.'
	Achievement.completion_check_funcs[senior_achievement_name] = projects_in_season_completion
	create_achievement_if_unexistant(senior_achievement_name, 'Has entregado 7 proyectos en una temporada de coaliciones.', 7)

	coalition_rank_name = 'Vengo a ver a mis fieles seguidores.'
	Achievement.completion_check_funcs[coalition_rank_name] = coalition_rank_name
	create_achievement_if_unexistant(coalition_rank_name, 'Inicia sesión en la plataforma siendo el primero de tu coalición', 1)


def create_achievement_if_unexistant(name: str, description: str, completion_points: int, icon_HTML: str | None) -> None:
	if Achievement.objects.filter(name=name).count() > 0:
		return
	to_add = Achievement(name=name, description=description, completion_points=completion_points)
	if icon_HTML != None:
		to_add.icon_HTML = icon_HTML

	to_add.save()


def dios_de_las_arepas_completion_check(user):
	if user.completion_date != None:
		return True
	completed = user.user.coalition_name.lower() == 'Marventis'.lower()
	user.progress = int(completed)
	return completed

def coalition_rank_completion(user):
	if user.completion_date != None:
		return True
	completed = user.user.coalition_rank <= 1
	user.progress = int(completed)
	return completed

def projects_in_season_completion(user):
	if user.completion_date != None:
		return True
	completion_points = user.achievement.completion_points
	projects_in_season = user.user.projects_delivered_current_season
	if projects_in_season > completion_points:
		projects_in_season = completion_points
	user.progress = projects_in_season

	return projects_in_season >= completion_points

def evaluation_points_completion(user):
	if user.completion_date != None:
		return True
	completion_points = user.achievement.completion_points
	evaluation_points = user.user.correction_points
	if evaluation_points > completion_points:
		evaluation_points = completion_points
	user.progress = evaluation_points

	return evaluation_points >= completion_points

def altarians_completion(user):
	if user.completion_date != None:
		return True
	completion_points = user.achievement.completion_points
	wallet = user.user.wallet
	if wallet > completion_points:
		wallet = completion_points
	user.progress = wallet

	return wallet >= completion_points
