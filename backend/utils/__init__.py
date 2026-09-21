"""Shared helpers used by the pose engine, the trainer and the evaluator.

Everything in here is imported by all three entry points. Keeping label
normalization and image preprocessing in one place is what prevents
train/serve skew: if the server and the trainer disagree about how an image
becomes a feature vector, the model is served inputs it never saw in training.
"""
